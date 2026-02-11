# =============================================================================
# Drofbot — Local Development Stack (PowerShell)
# =============================================================================
# Starts the full Drofbot development environment:
#   1. Gateway process (agent + Dashboard API on :18789)
#   2. Dashboard Vite dev server (HMR on :5173, proxies /api → :18789)
#
# Usage:  .\scripts\dev.ps1
# Stop:   Ctrl+C (kills all child processes)
# =============================================================================

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ROOT = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Push-Location $ROOT

# ─── Preflight checks ───────────────────────────────────────────────────────
if (-not (Test-Path ".env")) {
    Write-Host "[!] No .env file found. Copy .env.example → .env and fill in values." -ForegroundColor Yellow
    Write-Host "    cp .env.example .env" -ForegroundColor Gray
    Pop-Location
    exit 1
}

# Load .env into current session (simple key=value parser)
Get-Content ".env" | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#")) {
        $parts = $line -split "=", 2
        if ($parts.Length -eq 2) {
            [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
        }
    }
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         Drofbot — Local Development Stack           ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ─── Track child processes for cleanup ───────────────────────────────────────
$jobs = @()

function Cleanup {
    Write-Host ""
    Write-Host "[*] Shutting down..." -ForegroundColor Yellow
    foreach ($job in $script:jobs) {
        try {
            Stop-Job -Job $job -ErrorAction SilentlyContinue
            Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
        }
        catch {}
    }
    # Kill any lingering node processes on our ports
    Get-NetTCPConnection -LocalPort 18789 -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    Write-Host "[✓] All processes stopped." -ForegroundColor Green
    Pop-Location
}

# Register cleanup on Ctrl+C
$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action { Cleanup }
trap { Cleanup; break }

# ─── 1. Start Gateway (agent + Dashboard API) ───────────────────────────────
Write-Host "[1/2] Starting Gateway (agent + Dashboard API on :18789)..." -ForegroundColor Cyan

$gatewayJob = Start-Job -ScriptBlock {
    param($root)
    Set-Location $root
    # Load .env
    Get-Content ".env" | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#")) {
            $parts = $line -split "=", 2
            if ($parts.Length -eq 2) {
                [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
            }
        }
    }
    & node scripts/run-node.mjs gateway run --force 2>&1
} -ArgumentList $ROOT

$jobs += $gatewayJob
Write-Host "  → Gateway PID job: $($gatewayJob.Id)" -ForegroundColor Gray

# Give gateway a moment to start
Start-Sleep -Seconds 3

# ─── 2. Start Dashboard Vite Dev Server ──────────────────────────────────────
Write-Host "[2/2] Starting Dashboard dev server (Vite HMR on :5173)..." -ForegroundColor Cyan

$dashboardJob = Start-Job -ScriptBlock {
    param($root)
    Set-Location (Join-Path $root "src/dashboard")
    & npx vite --host 2>&1
} -ArgumentList $ROOT

$jobs += $dashboardJob
Write-Host "  → Dashboard PID job: $($dashboardJob.Id)" -ForegroundColor Gray

# ─── Status ──────────────────────────────────────────────────────────────────
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  Drofbot is running!" -ForegroundColor Green
Write-Host ""
Write-Host "  Dashboard UI:   http://localhost:5173" -ForegroundColor White
Write-Host "  Dashboard API:  http://localhost:18789/api/health" -ForegroundColor White
Write-Host "  Gateway WS:     ws://localhost:18789" -ForegroundColor White
Write-Host ""
Write-Host "  Press Ctrl+C to stop all services." -ForegroundColor Gray
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""

# ─── Stream logs ─────────────────────────────────────────────────────────────
try {
    while ($true) {
        # Print gateway output
        $gatewayOutput = Receive-Job -Job $gatewayJob -ErrorAction SilentlyContinue
        if ($gatewayOutput) {
            $gatewayOutput | ForEach-Object {
                Write-Host "[gateway] $_" -ForegroundColor DarkCyan
            }
        }

        # Print dashboard output
        $dashOutput = Receive-Job -Job $dashboardJob -ErrorAction SilentlyContinue
        if ($dashOutput) {
            $dashOutput | ForEach-Object {
                Write-Host "[dashboard] $_" -ForegroundColor DarkMagenta
            }
        }

        # Check if either process died
        if ($gatewayJob.State -eq "Failed" -or $gatewayJob.State -eq "Completed") {
            Write-Host "[!] Gateway process exited unexpectedly." -ForegroundColor Red
            Receive-Job -Job $gatewayJob -ErrorAction SilentlyContinue | Write-Host
            break
        }
        if ($dashboardJob.State -eq "Failed" -or $dashboardJob.State -eq "Completed") {
            Write-Host "[!] Dashboard process exited unexpectedly." -ForegroundColor Red
            Receive-Job -Job $dashboardJob -ErrorAction SilentlyContinue | Write-Host
            break
        }

        Start-Sleep -Milliseconds 500
    }
}
finally {
    Cleanup
}

# =============================================================================
# Drofbot — Health Check (PowerShell)
# =============================================================================
# Checks all services are running and responding.
# Usage:  .\scripts\health-check.ps1
# =============================================================================

$ErrorActionPreference = "SilentlyContinue"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║           Drofbot — Health Check                    ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$pass = 0
$fail = 0

function Check-Endpoint {
    param($Name, $Url, [switch]$Auth)

    try {
        $headers = @{}
        if ($Auth -and $env:DROFBOT_DASHBOARD_TOKEN) {
            $headers["Authorization"] = "Bearer $($env:DROFBOT_DASHBOARD_TOKEN)"
        }

        $response = Invoke-WebRequest -Uri $Url -Headers $headers -TimeoutSec 5 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "  [✓] $Name" -ForegroundColor Green -NoNewline
            Write-Host " — $Url" -ForegroundColor Gray
            $script:pass++
            return $true
        } else {
            Write-Host "  [✗] $Name" -ForegroundColor Red -NoNewline
            Write-Host " — HTTP $($response.StatusCode)" -ForegroundColor Gray
            $script:fail++
            return $false
        }
    } catch {
        Write-Host "  [✗] $Name" -ForegroundColor Red -NoNewline
        Write-Host " — $($_.Exception.Message)" -ForegroundColor DarkGray
        $script:fail++
        return $false
    }
}

function Check-Port {
    param($Name, $Port)

    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $procId = $conn[0].OwningProcess
        $procName = (Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName
        Write-Host "  [✓] $Name" -ForegroundColor Green -NoNewline
        Write-Host " — port $Port (PID $procId, $procName)" -ForegroundColor Gray
        $script:pass++
        return $true
    } else {
        Write-Host "  [✗] $Name" -ForegroundColor Red -NoNewline
        Write-Host " — port $Port not listening" -ForegroundColor DarkGray
        $script:fail++
        return $false
    }
}

# ─── Load .env if present ────────────────────────────────────────────────────
$ROOT = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$envFile = Join-Path $ROOT ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#")) {
            $parts = $line -split "=", 2
            if ($parts.Length -eq 2) {
                [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
            }
        }
    }
}

# ─── Checks ──────────────────────────────────────────────────────────────────

Write-Host "Services:" -ForegroundColor White
Check-Port "Gateway port"     18789
Check-Port "Dashboard Vite"   5173

Write-Host ""
Write-Host "API Endpoints:" -ForegroundColor White
Check-Endpoint "Health check"         "http://localhost:18789/api/health"
Check-Endpoint "Cosmic current"       "http://localhost:18789/api/cosmic/current" -Auth
Check-Endpoint "Profile"              "http://localhost:18789/api/profile" -Auth

Write-Host ""
Write-Host "Dashboard UI:" -ForegroundColor White
Check-Endpoint "Vite dev server"      "http://localhost:5173"

Write-Host ""
Write-Host "Env Config:" -ForegroundColor White
if ($env:DROFBOT_DASHBOARD_TOKEN) {
    Write-Host "  [✓] DROFBOT_DASHBOARD_TOKEN" -ForegroundColor Green -NoNewline
    Write-Host " — set ($($env:DROFBOT_DASHBOARD_TOKEN.Length) chars)" -ForegroundColor Gray
    $pass++
} else {
    Write-Host "  [✗] DROFBOT_DASHBOARD_TOKEN" -ForegroundColor Red -NoNewline
    Write-Host " — not set" -ForegroundColor DarkGray
    $fail++
}
if ($env:DROFBOT_SUPABASE_URL) {
    Write-Host "  [✓] DROFBOT_SUPABASE_URL" -ForegroundColor Green -NoNewline
    Write-Host " — $($env:DROFBOT_SUPABASE_URL)" -ForegroundColor Gray
    $pass++
} else {
    Write-Host "  [✗] DROFBOT_SUPABASE_URL" -ForegroundColor Red -NoNewline
    Write-Host " — not set" -ForegroundColor DarkGray
    $fail++
}
if ($env:DROFBOT_TELEGRAM_BOT_TOKEN) {
    Write-Host "  [✓] DROFBOT_TELEGRAM_BOT_TOKEN" -ForegroundColor Green -NoNewline
    Write-Host " — set" -ForegroundColor Gray
    $pass++
} else {
    Write-Host "  [✗] DROFBOT_TELEGRAM_BOT_TOKEN" -ForegroundColor Red -NoNewline
    Write-Host " — not set" -ForegroundColor DarkGray
    $fail++
}

# ─── Summary ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor White
if ($fail -eq 0) {
    Write-Host "  All $pass checks passed!" -ForegroundColor Green
} else {
    Write-Host "  $pass passed, $fail failed" -ForegroundColor Yellow
}
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor White
Write-Host ""

exit $fail

# Drofbot VPS Deployment Guide

**Target VPS:** `109.123.227.170` (Contabo Sydney, 4 vCPU, 8GB RAM, Ubuntu)  
**Repository:** `https://github.com/drhayf/drofbot.git`  
**Domain:** `drofy.net` (dashboard at `dashboard.drofy.net`)  
**Database:** Supabase Cloud (already configured with data from local testing)

---

## Overview

This guide deploys Drofbot to a VPS for 24/7 operation. The system includes:

- **Gateway** — Main agent process (Telegram bot, cron jobs, memory, expression engine)
- **Dashboard** — React web UI served via Caddy reverse proxy
- **Control UI** — OpenClaw control interface at `/__openclaw__/`
- **Cloudflare Tunnel** — Secure external access without opening ports

## Prerequisites

Before starting, ensure:

1. ✅ Local development is verified (all Phase 7 tests passed)
2. ✅ Code is pushed to GitHub: `https://github.com/drhayf/drofbot.git`
3. ✅ Supabase cloud database is running (data carries over)
4. ✅ Domain `drofy.net` is added to Cloudflare DNS
5. ✅ You have SSH access to `root@109.123.227.170`
6. ✅ Telegram bot token is ready (same as local: `@drdrofbot`)

---

## Step 1: SSH into the VPS

```bash
ssh root@109.123.227.170
```

If this is your first time, accept the host key fingerprint.

---

## Step 2: Run System Setup

The setup script installs all dependencies:

```bash
# Create a temp directory and download the script
mkdir -p /tmp/drofbot
cd /tmp/drofbot

# Option A: If you've already cloned the repo
cp /opt/drofbot/deployment/setup-vps.sh /tmp/drofbot/
bash setup-vps.sh

# Option B: Download directly from GitHub
curl -fsSL https://raw.githubusercontent.com/drhayf/drofbot/main/deployment/setup-vps.sh -o setup-vps.sh
bash setup-vps.sh
```

**What this installs:**
- Node.js 22 LTS
- pnpm (global)
- Caddy web server
- cloudflared (Cloudflare Tunnel)
- UFW firewall (SSH, HTTP, HTTPS allowed)
- `drofbot` user with home directory

**After completion:**
- Node: `node -v` → `v22.x.x`
- pnpm: `pnpm -v` → `10.x.x`
- Caddy: `caddy version`
- cloudflared: `cloudflared version`

---

## Step 3: Clone the Repository

```bash
# Create the app directory (may already exist from setup)
mkdir -p /opt/drofbot
chown drofbot:drofbot /opt/drofbot

# Clone as the drofbot user
sudo -u drofbot git clone https://github.com/drhayf/drofbot.git /opt/drofbot
cd /opt/drofbot
```

---

## Step 4: Install Dependencies

```bash
cd /opt/drofbot
pnpm install
```

This installs all Node.js dependencies including the OpenClaw core.

---

## Step 5: Build Everything

### 5a. Build the Backend

```bash
cd /opt/drofbot
npx tsdown
```

This compiles TypeScript to `dist/`.

### 5b. Build the Dashboard

```bash
cd /opt/drofbot/src/dashboard
npm install
npm run build
```

Output goes to `src/dashboard/dist/`.

### 5c. Build the Control UI

```bash
cd /opt/drofbot/ui
pnpm install
pnpm run build
```

Output goes to `dist/control-ui/`.

### 5d. Copy Dashboard to Serving Directory

```bash
mkdir -p /opt/drofbot/dashboard-dist
cp -r /opt/drofbot/src/dashboard/dist/* /opt/drofbot/dashboard-dist/
```

---

## Step 6: Production Environment

Copy the production environment file:

```bash
cp /opt/drofbot/deployment/.env.production /opt/drofbot/.env
```

**Verify the `.env` contains:**

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `DROFBOT_DOMAIN` | `drofy.net` |
| `DROFBOT_DASHBOARD_DOMAIN` | `dashboard.drofy.net` |
| `DROFBOT_SUPABASE_URL` | `https://xonmnzosnubojfawkaxh.supabase.co` |
| `DROFBOT_SUPABASE_ANON_KEY` | (your anon key) |
| `DROFBOT_SUPABASE_SERVICE_KEY` | (your service key) |
| `DROFBOT_TELEGRAM_BOT_TOKEN` | (your bot token) |
| `DROFBOT_TELEGRAM_CHAT_ID` | `5858823159` |
| `DROFBOT_LLM_PROVIDER` | `openrouter` |
| `DROFBOT_LLM_API_KEY` | (your OpenRouter key) |
| `DROFBOT_LLM_MODEL` | `anthropic/claude-opus-4.6` |
| `DROFBOT_DASHBOARD_TOKEN` | (64-char hex token) |
| `OPENCLAW_GATEWAY_TOKEN` | (gateway auth token) |

**Security note:** The `.env` file is gitignored and should NEVER be committed.

---

## Step 7: OpenClaw Configuration

The VPS starts with a fresh OpenClaw config. Run the config setup script:

```bash
cd /opt/drofbot
bash deployment/config-setup.sh
```

**What this configures:**
- Telegram channel (bot token, enabled, allowlist)
- Memory plugins (memory-core, llm-task, lobster)
- Embedding provider (OpenRouter → OpenAI-compatible API)
- Agent model (`anthropic/claude-opus-4.6`)
- Disabled services (browser, hooks)

See `deployment/config-setup.sh` for the full list of config commands.

---

## Step 8: Systemd Service

Install and start the Drofbot service:

```bash
# Copy the service file
sudo cp /opt/drofbot/deployment/drofbot.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable auto-start on boot
sudo systemctl enable drofbot

# Start the service
sudo systemctl start drofbot
```

**Verify:**

```bash
sudo systemctl status drofbot
```

Should show `active (running)`.

---

## Step 9: Caddy Reverse Proxy

### 9a. Install Caddyfile

```bash
sudo cp /opt/drofbot/deployment/Caddyfile /etc/caddy/Caddyfile
```

### 9b. Verify Caddyfile

The Caddyfile should serve:
- `dashboard.drofy.net` → static files from `/opt/drofbot/dashboard-dist`
- `/api/*` → reverse proxy to `localhost:18789`
- `/ws` → WebSocket proxy to `localhost:18789`

### 9c. Start Caddy

```bash
sudo systemctl enable caddy
sudo systemctl start caddy
sudo systemctl status caddy
```

**Note:** When using Cloudflare Tunnel, Caddy listens on `:8080` (HTTP only). The tunnel handles HTTPS.

---

## Step 10: Cloudflare Tunnel

The tunnel connects `drofy.net` to the VPS without exposing ports.

### 10a. Authenticate cloudflared

```bash
cloudflared login
```

This outputs a URL. Open it in your browser, select `drofy.net`, and authorize.

### 10b. Create the Tunnel

```bash
cloudflared tunnel create drofbot
```

Note the **Tunnel ID** (a UUID) from the output.

### 10c. Configure the Tunnel

Create `/etc/cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL-ID>
credentials-file: /root/.cloudflared/<TUNNEL-ID>.json

ingress:
  - hostname: dashboard.drofy.net
    service: http://localhost:8080
  
  - service: http_status:404
```

Replace `<TUNNEL-ID>` with your actual tunnel UUID.

### 10d. Create DNS Record

```bash
cloudflared tunnel route dns drofbot dashboard.drofy.net
```

### 10e. Run Tunnel as Service

```bash
cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

### 10f. Verify

```bash
# Check tunnel status
cloudflared tunnel info drofbot

# Check from internet
curl -sI https://dashboard.drofy.net
```

---

## Step 11: Verify Everything

### 11a. Service Health

```bash
# Drofbot gateway
sudo systemctl status drofbot
curl -s http://localhost:18789/api/health
# Expected: {"status":"ok"}

# Caddy
sudo systemctl status caddy
curl -s http://localhost:8080
# Expected: HTML from dashboard

# Cloudflare tunnel
sudo systemctl status cloudflared
cloudflared tunnel info drofbot
```

### 11b. Dashboard Access

Visit `https://dashboard.drofy.net` in your browser.

1. You should see the login page
2. Enter the dashboard token from `.env`
3. You should see the Observatory (home) page

### 11c. Telegram Bot

**CRITICAL:** Stop your local gateway first! The Telegram bot can only poll from one location.

```bash
# On your LOCAL machine, stop the gateway:
# (Kill the local process or close the terminal)
```

Then test on VPS:

```bash
# Check Telegram is connected
sudo journalctl -u drofbot -n 50 | grep -i telegram
# Expected: "starting provider (@drdrofbot)"
```

Send a message to `@drdrofbot` on Telegram. The bot should respond.

### 11d. API Endpoints

```bash
# Model
curl -s -H "Authorization: Bearer <TOKEN>" http://localhost:18789/api/models/current | jq .

# Memory stats
curl -s -H "Authorization: Bearer <TOKEN>" http://localhost:18789/api/memory/stats | jq .

# Cosmic data
curl -s -H "Authorization: Bearer <TOKEN>" http://localhost:18789/api/cosmic/current | jq .
```

---

## Step 12: Stop Local Gateway

**This is critical.** If both local and VPS gateways run simultaneously, they will fight over Telegram messages.

On your local machine:

```bash
# Find and kill the local gateway process
# On Windows (PowerShell):
Get-Process -Name node | Where-Object { $_.CommandLine -like "*gateway*" } | Stop-Process -Force

# On Mac/Linux:
pkill -f "gateway run"
```

Verify the VPS is now the only gateway:

```bash
# On VPS, watch logs for Telegram activity
sudo journalctl -u drofbot -f
```

Send a test message on Telegram. You should see it arrive in the VPS logs.

---

## Maintenance

### View Logs

```bash
# Gateway logs
sudo journalctl -u drofbot -f

# Caddy logs
sudo journalctl -u caddy -f

# Cloudflare tunnel logs
sudo journalctl -u cloudflared -f

# Raw log file
tail -f /opt/drofbot/logs/drofbot.log
```

### Restart Services

```bash
sudo systemctl restart drofbot
sudo systemctl restart caddy
sudo systemctl restart cloudflared
```

### Update Code

After pushing changes to GitHub:

```bash
cd /opt/drofbot
bash deployment/update.sh
```

Or manually:

```bash
cd /opt/drofbot
git pull --rebase origin main
pnpm install
npx tsdown
cd src/dashboard && npm run build && cd ../..
cp -r src/dashboard/dist/* dashboard-dist/
sudo systemctl restart drofbot
```

### Check Supabase Data

Connect to the Supabase dashboard at `https://supabase.com/dashboard` or use psql:

```bash
psql "postgresql://postgres:<password>@db.xonmnzosnubojfawkaxh.supabase.co:5432/postgres"
```

### Change Model

Via dashboard Settings → Model, or via Telegram:

```
/model anthropic/claude-sonnet-4
```

Or via config:

```bash
cd /opt/drofbot
node drofbot.mjs config set agents.defaults.model.primary "openrouter/anthropic/claude-sonnet-4"
sudo systemctl restart drofbot
```

---

## Troubleshooting

### Gateway won't start

```bash
# Check logs
sudo journalctl -u drofbot -n 100

# Common issues:
# - Missing .env file
# - Invalid Telegram token
# - Port 18789 already in use
```

### Dashboard shows 502

```bash
# Check if gateway is running
curl http://localhost:18789/api/health

# Check Caddy logs
sudo journalctl -u caddy -n 50
```

### Telegram not responding

```bash
# Check Telegram connection in logs
sudo journalctl -u drofbot | grep -i telegram

# Verify only ONE gateway is running (local must be stopped)
# Check the bot token is correct in .env
```

### Tunnel not working

```bash
# Check tunnel status
cloudflared tunnel info drofbot

# Check DNS
dig dashboard.drofy.net

# Check tunnel logs
sudo journalctl -u cloudflared -n 50
```

---

## File Reference

| File | Location | Purpose |
|------|----------|---------|
| `.env` | `/opt/drofbot/.env` | Production environment variables |
| `drofbot.json` | `~/.drofbot/drofbot.json` | OpenClaw config (auto-created) |
| `drofbot.log` | `/opt/drofbot/logs/drofbot.log` | Gateway log output |
| `Caddyfile` | `/etc/caddy/Caddyfile` | Reverse proxy config |
| `config.yml` | `/etc/cloudflared/config.yml` | Cloudflare tunnel config |

---

## Security Checklist

- [ ] `.env` file is NOT world-readable: `chmod 600 /opt/drofbot/.env`
- [ ] UFW firewall is active: `sudo ufw status`
- [ ] SSH key auth only (disable password): `PasswordAuthentication no` in `/etc/ssh/sshd_config`
- [ ] Dashboard token is strong (64-char hex)
- [ ] Telegram allowlist is configured (only your chat ID)
- [ ] Production tokens are DIFFERENT from dev tokens

---

## Success Criteria

After completing this guide:

- [ ] `https://dashboard.drofy.net` loads and accepts login
- [ ] Dashboard shows Observatory with weather/hypotheses/quests
- [ ] Telegram bot `@drdrofbot` responds to messages
- [ ] Memory search works (via dashboard or API)
- [ ] Cron jobs run (heartbeat every 30min, consolidation every 6h)
- [ ] Expression engine can trigger spontaneous messages
- [ ] Local gateway is stopped (VPS is the only active gateway)

---

**Deployment complete!** Drofbot is now running 24/7 on your VPS.

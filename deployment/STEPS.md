# Manual Deployment Steps

Follow these steps one at a time on your VPS as **root**.

## 1. System Setup (Minimal)

```bash
# Check what you already have
node --version
pnpm --version
caddy version
git --version

# Only install what's missing (skip if already installed)
apt update
apt install -y git curl wget
```

## 2. Add Swap Space (if low memory)

```bash
# Check current memory
free -h

# Create 2GB swap file
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Verify
free -h
```

## 3. Install Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Verify
node --version  # Should be v22.x.x
```

## 4. Install pnpm

```bash
npm install -g pnpm
pnpm --version
```

## 5. Install Caddy

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install -y caddy

# Verify
caddy version
```

## 6. Create User and Clone

```bash
# Create user
useradd -r -s /bin/bash -d /opt/drofbot drofbot

# Clone repo
git clone https://github.com/drhayf/drofbot.git /opt/drofbot
cd /opt/drofbot
chown -R drofbot:drofbot /opt/drofbot
```

## 7. Install Dependencies

```bash
su - drofbot
cd /opt/drofbot
export COREPACK_ENABLE=0
pnpm config set enable-pre-post-scripts false
pnpm install
```

## 8. Build

```bash
# Build backend
cd /opt/drofbot
npx tsdown

# Build dashboard
cd /opt/drofbot/src/dashboard
pnpm run build
```

## 9. Configure Environment

```bash
cat > /opt/drofbot/.env << EOF
DROFBOT_SUPABASE_URL=https://xonmnzosnubojfawkaxh.supabase.co
DROFBOT_SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhvbm1uem9zbnVib2pmYXdrYXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkyNTcyNDIsImV4cCI6MjA1NDgzMzI0Mn0.JiiIFCFPIqLoOJGkVDMMmF7oGDmB1MH0FvdWQT_NQHQ
DROFBOT_TELEGRAM_BOT_TOKEN=8398888517:AAEx04ovOBdETSQbma0dU1Q1PLCk4ehMYuw
DROFBOT_LLM_API_KEY=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
OPENROUTER_API_KEY=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
DROFBOT_LLM_MODEL=anthropic/claude-opus-4.6
DROFBOT_DASHBOARD_TOKEN=$(openssl rand -hex 32)
DROFBOT_PORT=18789
DROFBOT_HOST=0.0.0.0
EOF

chown drofbot:drofbot /opt/drofbot/.env
chmod 600 /opt/drofbot/.env
```

## 10. Configure OpenClaw

```bash
su - drofbot
cd /opt/drofbot

node drofbot.mjs config set channels.telegram.botToken '8398888517:AAEx04ovOBdETSQbma0dU1Q1PLCk4ehMYuw'
node drofbot.mjs config set channels.telegram.enabled true
node drofbot.mjs config set channels.telegram.dmPolicy allowlist
node drofbot.mjs config set 'channels.telegram.accounts.default.allowFrom' '[5858823159]'

node drofbot.mjs config set plugins.entries.memory-core.enabled true
node drofbot.mjs config set plugins.entries.llm-task.enabled true
node drofbot.mjs config set plugins.entries.lobster.enabled true
node drofbot.mjs config set plugins.entries.open-prose.enabled true

node drofbot.mjs config set 'tools.allow' '["lobster","llm-task","open-prose"]'

node drofbot.mjs config set agents.defaults.memorySearch.provider openai
node drofbot.mjs config set agents.defaults.memorySearch.model text-embedding-3-small
node drofbot.mjs config set agents.defaults.memorySearch.remote.baseUrl 'https://openrouter.ai/api/v1'
node drofbot.mjs config set agents.defaults.memorySearch.remote.apiKey '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'

node drofbot.mjs config set agents.defaults.model.primary 'openrouter/anthropic/claude-opus-4.6'

node drofbot.mjs config set browser.enabled false
node drofbot.mjs config set hooks.enabled false
node drofbot.mjs config set gateway.mode local
```

## 11. Create Service

```bash
cat > /etc/systemd/system/drofbot.service << EOF
[Unit]
Description=Drofbot Gateway Service
After=network.target

[Service]
Type=simple
User=drofbot
Group=drofbot
WorkingDirectory=/opt/drofbot
EnvironmentFile=/opt/drofbot/.env
ExecStart=/usr/bin/node /opt/drofbot/drofbot.mjs gateway run --port 18789 --force
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=drofbot

NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/drofbot
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable drofbot
systemctl start drofbot
```

## 12. Configure Caddy

```bash
cat > /etc/caddy/Caddyfile << EOF
droffy.net {
    email admin@drofy.net

    root * /opt/drofbot/src/dashboard/dist
    file_server

    handle /api/* {
        reverse_proxy localhost:18789
    }

    handle /ws/* {
        reverse_proxy localhost:18789
    }

    handle {
        try_files {path} /index.html
        file_server
    }
}

:8080 {
    reverse_proxy localhost:18789
}
EOF

systemctl enable caddy
systemctl start caddy
```

## 13. Verify

```bash
# Check services
systemctl status drofbot
systemctl status caddy

# View logs
journalctl -u drofbot -f
```

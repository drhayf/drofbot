# Cloudflare Tunnel Setup for Drofbot VPS

This guide sets up a Cloudflare Tunnel to expose the Drofbot dashboard to the internet with HTTPS, without opening ports 80/443 directly on the VPS.

## Architecture

```
Internet → Cloudflare (DNS + TLS) → Tunnel → VPS (cloudflared → Caddy :8080 → Dashboard + API)
```

## Prerequisites

- A Cloudflare account (free tier works)
- The domain `drofy.net` added to Cloudflare DNS
- `cloudflared` installed on VPS (done by `setup-vps.sh`)

## Step-by-Step Setup

### 1. Authenticate cloudflared

```bash
# On the VPS, as root:
cloudflared login
```

This opens a browser URL. Copy it to your local browser, select your domain, and authorize. A certificate is saved to `~/.cloudflared/cert.pem`.

### 2. Create the tunnel

```bash
cloudflared tunnel create drofbot
```

This outputs a tunnel ID (UUID) and creates a credentials file at `~/.cloudflared/<TUNNEL-ID>.json`.

Note the **Tunnel ID** — you'll need it below.

### 3. Configure the tunnel

Create `/etc/cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL-ID>
credentials-file: /root/.cloudflared/<TUNNEL-ID>.json

ingress:
  # Dashboard + API
  - hostname: dashboard.drofy.net
    service: http://localhost:8080
  
  # Catch-all (required by cloudflared)
  - service: http_status:404
```

Replace:
- `<TUNNEL-ID>` with your actual tunnel UUID

### 4. Create DNS records

```bash
cloudflared tunnel route dns drofbot dashboard.drofy.net
```

This creates a CNAME record in Cloudflare DNS pointing `dashboard.drofy.net` to your tunnel.

### 5. Test the tunnel

```bash
cloudflared tunnel run drofbot
```

Visit `https://dashboard.drofy.net` — you should see the Drofbot dashboard.

### 6. Run as systemd service

```bash
cloudflared service install
systemctl enable cloudflared
systemctl start cloudflared
```

This creates `/etc/systemd/system/cloudflared.service` pointing to your config.

### 7. Verify

```bash
# Check tunnel status
cloudflared tunnel info drofbot

# Check systemd
systemctl status cloudflared

# Check from internet
curl -sI https://dashboard.drofy.net
```

## Updating

After deploying new code:
- Caddy and the Drofbot service restart via `deployment/deploy.sh`
- The tunnel doesn't need restarting (it's a persistent connection)

## Troubleshooting

```bash
# Tunnel logs
journalctl -u cloudflared -f

# Caddy logs
journalctl -u caddy -f
tail -f /opt/drofbot/logs/caddy-access.log

# Drofbot logs
journalctl -u drofbot -f
tail -f /opt/drofbot/logs/drofbot.log

# Check if services are listening
ss -tlnp | grep -E '8080|18789'
```

## Security Notes

- The VPS firewall only allows SSH (22). Ports 80/443 are allowed by `setup-vps.sh` but Caddy listens on 8080 (behind tunnel).
- If you want Caddy to also serve directly (no tunnel), change the Caddyfile address from `:8080` to `dashboard.drofy.net` and Caddy will auto-provision TLS via Let's Encrypt.
- The tunnel encrypts traffic end-to-end between Cloudflare and your VPS.

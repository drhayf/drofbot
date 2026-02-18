#!/bin/bash
# Summarizes recent DNS traffic into a structured JSON file
# Run every 15 minutes via cron

LOG_DIR="/opt/drofbot/.drofbot/traffic"
LOG_FILE="$LOG_DIR/dns-queries.log"
OUTPUT_FILE="$LOG_DIR/traffic-context.json"
MINUTES=15  # Summarize last N minutes

if [ ! -f "$LOG_FILE" ]; then
  echo '{"error":"no traffic log found"}' > "$OUTPUT_FILE"
  exit 0
fi

# Get current time and cutoff
NOW=$(date +%s)
CUTOFF=$((NOW - MINUTES * 60))

# Process the log
python3 << 'PYEOF'
import json
import sys
import os
from datetime import datetime, timedelta
from collections import Counter, defaultdict

log_file = os.environ.get('LOG_FILE', '/opt/drofbot/.drofbot/traffic/dns-queries.log')
output_file = os.environ.get('OUTPUT_FILE', '/opt/drofbot/.drofbot/traffic/traffic-context.json')
minutes = int(os.environ.get('MINUTES', '15'))

cutoff = datetime.now() - timedelta(minutes=minutes)
domains = Counter()
categories = defaultdict(list)

# Domain categorization rules
CATEGORY_RULES = {
    'development': ['github.com', 'gitlab.com', 'stackoverflow.com', 'npmjs.com', 'pypi.org', 'docs.', 'api.'],
    'ai': ['claude.ai', 'anthropic.com', 'openai.com', 'chat.openai.com', 'gemini.google.com', 'openrouter.ai', 'huggingface.co'],
    'social': ['twitter.com', 'x.com', 'reddit.com', 'instagram.com', 'facebook.com', 'tiktok.com', 'youtube.com', 'threads.net'],
    'communication': ['telegram.org', 'web.telegram.org', 'whatsapp.com', 'discord.com', 'slack.com', 'mail.google.com'],
    'search': ['google.com', 'www.google.com', 'duckduckgo.com', 'bing.com', 'brave.com'],
    'media': ['spotify.com', 'netflix.com', 'twitch.tv', 'soundcloud.com', 'apple.com'],
    'finance': ['coinbase.com', 'binance.com', 'tradingview.com', 'afterpay.com', 'commbank.com.au'],
    'shopping': ['amazon.com', 'ebay.com', 'gumtree.com.au'],
    'productivity': ['notion.so', 'linear.app', 'figma.com', 'canva.com', 'docs.google.com'],
}

# Filter out noise domains
NOISE_PATTERNS = [
    'cloudflare', 'akamai', 'fastly', 'cdn', 'analytics', 'tracking',
    'telemetry', 'crash', 'update', 'push', 'notification', 'metric',
    'apple-dns', 'icloud-content', 'mzstatic', 'gstatic', 'googleapis',
    'doubleclick', 'googlesyndication', 'facebook.net', 'fbcdn',
    'cloudfront', 'amazonaws', 'azurefd', 'microsoftonline',
]

def is_noise(domain):
    domain_lower = domain.lower()
    return any(noise in domain_lower for noise in NOISE_PATTERNS)

def categorize(domain):
    domain_lower = domain.lower()
    for category, patterns in CATEGORY_RULES.items():
        for pattern in patterns:
            if pattern in domain_lower:
                return category
    return 'other'

# Read and parse log
try:
    with open(log_file, 'r') as f:
        for line in f:
            parts = line.strip().split(' ', 1)
            if len(parts) != 2:
                continue
            timestamp_str, domain = parts
            # Skip noise
            if is_noise(domain):
                continue
            domains[domain] += 1
            cat = categorize(domain)
            if domain not in categories[cat]:
                categories[cat].append(domain)
except FileNotFoundError:
    pass

# Build summary
active_categories = {k: v for k, v in categories.items() if v and k != 'other'}
top_domains = domains.most_common(20)

summary = {
    'generated_at': datetime.now().isoformat(),
    'window_minutes': minutes,
    'total_queries': sum(domains.values()),
    'unique_domains': len(domains),
    'active_categories': {k: v[:10] for k, v in active_categories.items()},
    'top_domains': [{'domain': d, 'queries': c} for d, c in top_domains],
    'activity_summary': '',  # Will be filled below
}

# Generate human-readable summary
parts = []
if 'development' in active_categories:
    parts.append(f"coding/development ({', '.join(active_categories['development'][:3])})")
if 'ai' in active_categories:
    parts.append(f"AI tools ({', '.join(active_categories['ai'][:3])})")
if 'social' in active_categories:
    parts.append(f"social media ({', '.join(active_categories['social'][:3])})")
if 'communication' in active_categories:
    parts.append(f"messaging ({', '.join(active_categories['communication'][:3])})")
if 'search' in active_categories:
    parts.append("web searching")
if 'media' in active_categories:
    parts.append(f"media ({', '.join(active_categories['media'][:3])})")
if 'finance' in active_categories:
    parts.append("financial activity")

if parts:
    summary['activity_summary'] = f"User is currently engaged in: {'; '.join(parts)}"
else:
    summary['activity_summary'] = "No significant user activity detected in this window"

with open(output_file, 'w') as f:
    json.dump(summary, f, indent=2)

# Rotate log — keep only last hour
# (prevents unbounded growth)
try:
    with open(log_file, 'r') as f:
        lines = f.readlines()
    # Keep last 5000 lines
    if len(lines) > 5000:
        with open(log_file, 'w') as f:
            f.writelines(lines[-5000:])
except:
    pass

PYEOF

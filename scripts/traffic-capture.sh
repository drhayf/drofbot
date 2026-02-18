#!/bin/bash
# Captures DNS queries from the WireGuard interface
# Runs continuously, appends to a rolling log

IFACE="wg0"
LOG_DIR="/opt/drofbot/.drofbot/traffic"
mkdir -p "$LOG_DIR"

# Capture DNS queries (port 53) on the WireGuard interface
# Output: timestamp + queried domain
tcpdump -i "$IFACE" -n -l port 53 2>/dev/null | \
  grep --line-buffered 'A?' | \
  awk '{
    # Extract timestamp and domain
    ts = $1;
    for (i=1; i<=NF; i++) {
      if ($i == "A?") {
        domain = $(i+1);
        gsub(/\.$/, "", domain);  # Remove trailing dot
        print ts " " domain;
        break;
      }
    }
  }' >> "$LOG_DIR/dns-queries.log"

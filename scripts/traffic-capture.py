#!/usr/bin/env python3
"""
Traffic Capture - Captures ALL VPN traffic and categorizes it
Uses tshark to capture packets, then processes them for agent awareness
"""

import json
import os
import re
import subprocess
import sys
import time
from collections import defaultdict
from datetime import datetime
from pathlib import Path

# Configuration
IFACE = "wg0"
LOG_DIR = Path("/opt/drofbot/.drofbot/traffic")
OUTPUT_FILE = LOG_DIR / "traffic-context.json"
CAPTURE_DURATION = 60  # seconds to capture before processing

# Known service signatures
SERVICE_SIGNATURES = {
    # Meta/Facebook (IPv6 contains face:b00c)
    "face:b00c": "Meta (Facebook/Instagram/WhatsApp)",
    # Meta/Facebook IPv4 ranges
    "157.240.": "Meta (Facebook/Instagram/WhatsApp)",
    "31.13.": "Meta (Facebook/Instagram/WhatsApp)",
    "69.63.": "Meta (Facebook)",
    "69.171.": "Meta (Facebook)",
    # Google
    "142.250.": "Google",
    "172.217.": "Google",
    "216.58.": "Google",
    "142.250.": "Google",
    "2a00:1450:": "Google (IPv6)",
    # Cloudflare
    "1.1.1.1": "Cloudflare DNS",
    "1.0.0.1": "Cloudflare DNS",
    "104.16.": "Cloudflare",
    "104.24.": "Cloudflare",
    "2606:4700:": "Cloudflare (IPv6)",
    # Apple
    "17.": "Apple",
    "2620:149:": "Apple (IPv6)",
    # Microsoft
    "20.": "Microsoft",
    "40.": "Microsoft/Azure",
    "52.": "Microsoft/Azure",
    "2a01:111:": "Microsoft (IPv6)",
    # Amazon
    "3.": "Amazon AWS",
    "54.": "Amazon AWS",
    "52.": "Amazon AWS (shared with MS)",
    # GitHub
    "140.82.": "GitHub",
    # Twitter/X
    "104.244.": "Twitter/X",
    # Discord
    "162.159.": "Discord",
    "188.114.": "Discord/Cloudflare",
    # Telegram
    "149.154.": "Telegram",
    "91.108.": "Telegram",
    # Signal
    "13.107.": "Signal/Microsoft",
    # Netflix
    "23.246.": "Netflix",
    "45.57.": "Netflix",
    # Spotify
    "35.186.": "Spotify/Google",
    # OpenAI
    "104.18.": "OpenAI (Cloudflare)",
}

# Activity categories
ACTIVITY_CATEGORIES = {
    "social": [
        "meta",
        "facebook",
        "instagram",
        "whatsapp",
        "twitter",
        "tiktok",
        "snapchat",
        "linkedin",
    ],
    "communication": [
        "whatsapp",
        "telegram",
        "signal",
        "discord",
        "slack",
        "messenger",
        "gmail",
        "outlook",
    ],
    "search": ["google", "bing", "duckduckgo"],
    "development": ["github", "gitlab", "bitbucket", "stackoverflow", "npmjs", "pypi"],
    "ai": [
        "openai",
        "anthropic",
        "claude",
        "chatgpt",
        "perplexity",
        "gemini",
        "copilot",
    ],
    "media": ["youtube", "netflix", "spotify", "twitch", "plex", "soundcloud"],
    "cloud": ["cloudflare", "aws", "azure", "gcp", "digitalocean", "amazon"],
    "apple": ["apple", "icloud", "itunes"],
    "microsoft": ["microsoft", "office", "outlook", "teams"],
}


def identify_service(ip: str) -> str:
    """Identify service from IP address"""
    ip_lower = ip.lower()
    for signature, service in SERVICE_SIGNATURES.items():
        if signature in ip_lower:
            return service
    return None


def categorize_activity(service: str) -> str:
    """Categorize service into activity type"""
    service_lower = service.lower()
    for category, keywords in ACTIVITY_CATEGORIES.items():
        for keyword in keywords:
            if keyword in service_lower:
                return category
    return "other"


def capture_traffic(duration: int = CAPTURE_DURATION) -> list:
    """Capture traffic using tshark"""
    packets = []

    try:
        proc = subprocess.Popen(
            ["tshark", "-i", IFACE, "-n", "-l"],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
        )

        start_time = time.time()

        for line in proc.stdout:
            if time.time() - start_time > duration:
                break

            # Parse line: "    1 0.000000000 fd42:42:42::2 → 2a03:2880:... UDP 160 54148 → 443 Len=112"
            match = re.search(r"([a-f0-9:.]+)\s*→\s*([a-f0-9:.]+)", line)
            if match:
                src_ip = match.group(1)
                dst_ip = match.group(2)

                # Extract protocol and size
                proto_match = re.search(r"(TCP|UDP|SSL|TLS|HTTP|QUIC)\s+(\d+)", line)
                if proto_match:
                    proto = proto_match.group(1)
                    size = int(proto_match.group(2))

                    # Extract port
                    port_match = re.search(r"→\s*(\d+)", line)
                    dst_port = int(port_match.group(1)) if port_match else 0

                    packets.append(
                        {
                            "src_ip": src_ip,
                            "dst_ip": dst_ip,
                            "dst_port": dst_port,
                            "protocol": proto,
                            "size": size,
                        }
                    )

        proc.terminate()

    except Exception as e:
        print(f"Error capturing traffic: {e}", file=sys.stderr)

    return packets


def summarize_traffic(packets: list) -> dict:
    """Summarize captured traffic"""
    if not packets:
        return {
            "generated_at": datetime.now().isoformat(),
            "total_packets": 0,
            "total_bytes": 0,
            "unique_destinations": 0,
            "connections": [],
            "activity_summary": "No traffic captured",
        }

    # Group by destination IP
    ip_stats = defaultdict(lambda: {"packets": 0, "bytes": 0, "ports": set()})

    for pkt in packets:
        # Only count outgoing traffic (from VPN client)
        if pkt["src_ip"].startswith("fd42:42:42:") or pkt["src_ip"].startswith(
            "10.66.66."
        ):
            dst = pkt["dst_ip"]
            ip_stats[dst]["packets"] += 1
            ip_stats[dst]["bytes"] += pkt["size"]
            ip_stats[dst]["ports"].add(pkt["dst_port"])

    # Identify services
    connections = []
    for ip, stats in sorted(
        ip_stats.items(), key=lambda x: x[1]["bytes"], reverse=True
    ):
        service = identify_service(ip)
        if not service:
            service = "Unknown"

        category = categorize_activity(service)

        connections.append(
            {
                "ip": ip,
                "service": service,
                "category": category,
                "packets": stats["packets"],
                "bytes": stats["bytes"],
                "ports": sorted(list(stats["ports"])),
            }
        )

    # Generate activity summary
    category_bytes = defaultdict(int)
    for conn in connections:
        category_bytes[conn["category"]] += conn["bytes"]

    total_bytes = sum(c["bytes"] for c in connections)
    activity_parts = []

    for cat, bytes_count in sorted(
        category_bytes.items(), key=lambda x: x[1], reverse=True
    ):
        if bytes_count > 0 and total_bytes > 0:
            pct = bytes_count / total_bytes * 100
            if pct > 1:  # Only show categories > 1%
                activity_parts.append(f"{cat}: {pct:.0f}%")

    activity_summary = (
        " | ".join(activity_parts) if activity_parts else "Minimal activity"
    )

    return {
        "generated_at": datetime.now().isoformat(),
        "total_packets": len(packets),
        "total_bytes": total_bytes,
        "unique_destinations": len(ip_stats),
        "connections": connections[:20],  # Top 20
        "activity_summary": activity_summary,
    }


def main():
    """Main entry point"""
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Capturing traffic on {IFACE} for {CAPTURE_DURATION} seconds...")
    packets = capture_traffic(CAPTURE_DURATION)

    print(f"Captured {len(packets)} packets")
    summary = summarize_traffic(packets)

    # Write output
    with open(OUTPUT_FILE, "w") as f:
        json.dump(summary, f, indent=2)

    print(f"Activity: {summary['activity_summary']}")
    print(f"Output written to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()

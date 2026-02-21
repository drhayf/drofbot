#!/usr/bin/env python3
import sys, json, re

data = json.load(sys.stdin)
print(f"Total entries: {len(data)}")

print("\nCategories:")
cats = {}
for d in data:
    cat = d.get("category", "unknown")
    cats[cat] = cats.get(cat, 0) + 1
for c, n in sorted(cats.items()):
    print(f"  {c}: {n}")

# Corruption patterns
corruption_patterns = [
    (r"import\s+type\s*{", "import type"),
    (r"import\s+{", "import {"),
    (r"from\s+['\"][@./]", "from module"),
    (r"createSubsystemLogger", "createSubsystemLogger"),
    (r"OpenClawConfig", "OpenClawConfig"),
    (r"SEFLG_", "SEFLG_"),
    (r"function\s+\w+\s*\(", "function declaration"),
    (r"\bconst\s+\w+\s*=", "const declaration"),
]

print("\n=== Checking for corruption ===")
corrupted = []
for d in data:
    content_str = json.dumps(d.get("content", {}))
    for pattern, name in corruption_patterns:
        if re.search(pattern, content_str):
            corrupted.append(
                {
                    "category": d.get("category"),
                    "key": d.get("key"),
                    "pattern": name,
                    "preview": content_str[:300],
                }
            )
            break

print(f"\nCorrupted entries: {len(corrupted)}")
for c in corrupted:
    print(f"\n[{c['category']}/{c['key']}] - {c['pattern']}:")
    print(f"  {c['preview'][:200]}...")

print("\n=== All entries detail ===")
for d in data:
    print(f"\n[{d.get('category')}/{d.get('key')}]:")
    content = json.dumps(d.get("content"), indent=2)
    print(content[:800])

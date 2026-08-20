#!/usr/bin/env python3
"""Load consolidated permit rows into Supabase. Usage: load_permits.py <json_file> [--go]"""
import json, os, sys, urllib.request

SCRATCH = r"C:\Users\MORGAN~1\AppData\Local\Temp\claude\C--Users-Morgan-Brawner-Documents-Pathwaze-Local\90e37bc4-0d1b-4be2-b7b2-88693e7c96b3\scratchpad"

def env(key):
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env.local"), encoding="utf-8") as f:
        for line in f:
            if line.startswith(key + "="):
                return line.split("=", 1)[1].strip().strip('"').strip()
    raise SystemExit(f"missing {key}")

def main():
    if len(sys.argv) < 2:
        raise SystemExit("usage: load_permits.py <json_file> [--go]")
    path = sys.argv[1]
    if not os.path.isabs(path):
        path = os.path.join(SCRATCH, path)
    go = "--go" in sys.argv
    with open(path, encoding="utf-8") as f:
        rows = json.load(f)
    url = env("NEXT_PUBLIC_SUPABASE_URL").rstrip("/") + "/rest/v1/permits"
    key = env("SUPABASE_SERVICE_ROLE_KEY")
    print(f"File: {path}\nRows: {len(rows)}\nTarget: {url}")
    if not go:
        print("DRY RUN — pass --go to insert. First row preview:")
        print(json.dumps(rows[0], indent=2)[:800])
        return
    body = json.dumps(rows).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "apikey": key, "Authorization": f"Bearer {key}",
        "Content-Type": "application/json", "Prefer": "return=representation",
    })
    with urllib.request.urlopen(req) as resp:
        inserted = json.loads(resp.read())
    print(f"INSERTED {len(inserted)} rows (HTTP {resp.status}).")

if __name__ == "__main__":
    main()

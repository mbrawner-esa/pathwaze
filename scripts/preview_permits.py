#!/usr/bin/env python3
import json, os
from collections import defaultdict
SCRATCH = r"C:\Users\MORGAN~1\AppData\Local\Temp\claude\C--Users-Morgan-Brawner-Documents-Pathwaze-Local\90e37bc4-0d1b-4be2-b7b2-88693e7c96b3\scratchpad"
rows = []
for fn in ("final_permits_clean.json", "final_permits_existing.json"):
    with open(os.path.join(SCRATCH, fn), encoding="utf-8") as f:
        rows += json.load(f)
# merge project name back for grouping
PID2NAME = {
  "b73af547-6278-4adf-a2a3-661ab2fa5351":"AdventHealth Apopka",
  "9a77cebd-4dcb-4774-9f77-5e5345ac6269":"AdventHealth Daytona Beach",
  "f90f2e27-d450-4726-8e17-39097251aa3d":"AdventHealth Tampa",
  "7b7207d7-cb74-49b5-82c4-483b12abe310":"AdventHealth Celebration",
  "970c5d2c-a319-415f-90c2-90f0dc9f52e4":"AdventHealth Waterman",
  "79955ecf-a588-4233-9a11-7fe850e64469":"AdventHealth East Orlando",
  "197aa79c-c03e-428b-86c2-213ea77b74a3":"AdventHealth Fish Memorial",
  "779f5390-31eb-4234-8c92-737f1dc44c89":"AdventHealth Zephyrhills",
  "78452117-1794-454e-bca8-2815bdc0d9b8":"AdventHealth Palm Coast",
  "8281a423-c94e-4ed2-941c-0d19cdf4023f":"AdventHealth Wesley Chapel",
  "050d1679-3628-42ff-b6d4-f20540b7f275":"AdventHealth DeLand",
  "8ddfe971-e5b6-4eb3-8c3f-5a0fd977e2cf":"AdventHealth Winter Garden",
  "304986e3-16a5-4e7a-81b9-fd2c943add96":"Adventist Bolingbrook",
  "02f139a5-4b0c-4f62-a93a-9dac852446fa":"Adventist GlenOaks",
  "24e65f76-ce05-492e-a844-60f1264e87fb":"AdventHealth Hinsdale",
  "77b7ba54-4951-4f24-8b08-1dcfb4013873":"Adventist LaGrange",
}
g = defaultdict(list)
for r in rows:
    g[PID2NAME[r["project_id"]]].append(r)
def rpn(notes):
    for line in notes.split("\n\n"):
        if line.startswith("Report permit: "):
            return line[len("Report permit: "):]
    return ""
for pname in sorted(g):
    print(f"\n### {pname}  ({len(g[pname])})")
    print("| Cat | Type | Level | Authority | Stage | ~days |")
    print("|---|---|---|---|---|--:|")
    for r in sorted(g[pname], key=lambda x: (x["category"] != "Discretionary", x["name"])):
        c = "D" if r["category"] == "Discretionary" else "M"
        d = r["est_review_days"] if r["est_review_days"] is not None else "—"
        rp = rpn(r["notes"])
        typ = r["name"] + (f" ({rp})" if rp else "")
        print(f"| {c} | {typ} | {r['level']} | {r['ahj']} | {r['stage'] or '—'} | {d} |")

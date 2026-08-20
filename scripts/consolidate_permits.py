#!/usr/bin/env python3
"""Consolidate Permit Scout batch extractions into permit rows for Pathwaze."""
import json, html, os

HERE = os.path.dirname(os.path.abspath(__file__))
SCRATCH = r"C:\Users\MORGAN~1\AppData\Local\Temp\claude\C--Users-Morgan-Brawner-Documents-Pathwaze-Local\90e37bc4-0d1b-4be2-b7b2-88693e7c96b3\scratchpad"

# folder_id -> (project_id, pathwaze_name, has_existing_rows)
MAP = {
  "375575303986": ("b73af547-6278-4adf-a2a3-661ab2fa5351", "AdventHealth Apopka", True),
  "375573950137": ("9a77cebd-4dcb-4774-9f77-5e5345ac6269", "AdventHealth Daytona Beach", False),
  "375573570161": ("f90f2e27-d450-4726-8e17-39097251aa3d", "AdventHealth Tampa", False),
  "375577120286": ("7b7207d7-cb74-49b5-82c4-483b12abe310", "AdventHealth Celebration", False),
  "375575913321": ("970c5d2c-a319-415f-90c2-90f0dc9f52e4", "AdventHealth Waterman", False),
  "375573966627": ("79955ecf-a588-4233-9a11-7fe850e64469", "AdventHealth East Orlando", False),
  "375757496515": ("197aa79c-c03e-428b-86c2-213ea77b74a3", "AdventHealth Fish Memorial", False),
  "375576318968": ("779f5390-31eb-4234-8c92-737f1dc44c89", "AdventHealth Zephyrhills", False),
  "375574403133": ("78452117-1794-454e-bca8-2815bdc0d9b8", "AdventHealth Palm Coast", True),
  "375572966114": ("8281a423-c94e-4ed2-941c-0d19cdf4023f", "AdventHealth Wesley Chapel", False),
  "375575877578": ("050d1679-3628-42ff-b6d4-f20540b7f275", "AdventHealth DeLand", False),
  "375572591703": ("8ddfe971-e5b6-4eb3-8c3f-5a0fd977e2cf", "AdventHealth Winter Garden", False),
  "375573282918": ("304986e3-16a5-4e7a-81b9-fd2c943add96", "Adventist Bolingbrook", False),
  "375572874475": ("02f139a5-4b0c-4f62-a93a-9dac852446fa", "Adventist GlenOaks", True),
  "375573225103": ("24e65f76-ce05-492e-a844-60f1264e87fb", "AdventHealth Hinsdale", False),
  "375573100154": ("77b7ba54-4951-4f24-8b08-1dcfb4013873", "Adventist LaGrange", False),
}

def clean(s):
    return html.unescape(s).replace("\u00a0", " ").strip() if s else s

# Load enriched notes if present: folder_id -> {report_permit_name -> note}
NOTES = {}
for nf in ("notesA.json", "notesB.json", "notesC.json", "notesD.json"):
    fp = os.path.join(SCRATCH, nf)
    if os.path.exists(fp):
        with open(fp, encoding="utf-8") as f:
            for rpt in json.load(f)["reports"]:
                NOTES.setdefault(rpt["folder_id"], {})
                for pm in rpt["permits"]:
                    NOTES[rpt["folder_id"]][clean(pm["report_permit_name"])] = clean(pm["note"])

UNMATCHED = []
def build_notes(p, label, folder_id):
    rpn = clean(p.get("report_permit_name") or "")
    enriched = NOTES.get(folder_id, {}).get(rpn)
    if not enriched:
        UNMATCHED.append(f"{label} :: {rpn}")
    parts = []
    if rpn and rpn.lower() != p["name"].lower():
        parts.append(f"Report permit: {rpn}")
    if enriched:
        parts.append(enriched)
    else:
        # fallback to raw review_description + timeline if no enriched note yet
        rd = clean(p.get("review_description") or "")
        tn = clean(p.get("timeline_note") or "")
        if rd:
            parts.append(rd)
        if tn:
            parts.append(f"Est. timeline: {tn}")
    parts.append(f"Source: Permit Scout report ({label})")
    return "\n\n".join(parts)

def rows_from(batch_file):
    with open(os.path.join(SCRATCH, batch_file), encoding="utf-8") as f:
        data = json.load(f)
    out = []
    for rpt in data["reports"]:
        fid = rpt["folder_id"]
        pid, pname, has_existing = MAP[fid]
        for p in rpt["permits"]:
            if p["name"] == "Interconnection Agreement" or p.get("level") == "Utility":
                continue  # utility/interconnection captured on the Utility tab
            out.append({
                "project_id": pid,
                "_project": pname,
                "_has_existing": has_existing,
                "name": p["name"],
                "category": p["category"],
                "level": p["level"],
                "status": "Not Started",
                "ahj": clean(p.get("ahj")),
                "permit_number": None,
                "inspector": None,
                "required": True,
                "stage": p.get("stage") or None,
                "est_cost": None,
                "est_review_days": p.get("est_review_days"),
                "submitted_at": None,
                "approved_at": None,
                "expiry_date": None,
                "notes": build_notes(p, rpt["label"], fid),
            })
    return out

all_rows = []
for b in ("batchA.json", "batchB.json", "batchC.json", "batchD.json"):
    all_rows += rows_from(b)

clean_rows    = [r for r in all_rows if not r["_has_existing"]]
existing_rows = [r for r in all_rows if r["_has_existing"]]

def strip(rows):
    return [{k: v for k, v in r.items() if not k.startswith("_")} for r in rows]

with open(os.path.join(SCRATCH, "final_permits_clean.json"), "w", encoding="utf-8") as f:
    json.dump(strip(clean_rows), f, indent=2)
with open(os.path.join(SCRATCH, "final_permits_existing.json"), "w", encoding="utf-8") as f:
    json.dump(strip(existing_rows), f, indent=2)

# Summary
from collections import defaultdict, Counter
by_proj = defaultdict(lambda: {"D": 0, "M": 0})
for r in all_rows:
    by_proj[r["_project"]]["D" if r["category"] == "Discretionary" else "M"] += 1

print(f"TOTAL rows: {len(all_rows)}  | clean-project rows: {len(clean_rows)}  | existing-project rows: {len(existing_rows)}")
enriched_ct = sum(1 for r in all_rows if "Source: Permit Scout" in r["notes"])
print(f"Rows WITHOUT an enriched note (fell back): {len(UNMATCHED)}")
for u in UNMATCHED:
    print("   ! " + u)
print(f"{'Project':<34}{'Disc':>5}{'Min':>5}{'Tot':>5}   existing?")
for pid, pname, he in sorted(MAP.values(), key=lambda x: x[1]):
    d = by_proj[pname]["D"]; m = by_proj[pname]["M"]
    print(f"{pname:<34}{d:>5}{m:>5}{d+m:>5}   {'YES (curated)' if he else ''}")
print("\nCanonical type distribution:")
for name, c in Counter(r["name"] for r in all_rows).most_common():
    print(f"  {name:<32}{c}")

"""One-off parser: AdventHealth 21460 bulk-upload workbook -> typed JSON.

Reads the Phase II feasibility export and emits scripts/_import-data.json with
three arrays (buildings, meters, pricing) mapped 1:1 to Pathwaze DB columns.
No DB access here -- pure transform + validation. Throwaway support script.
"""
import json
import datetime
import openpyxl

SRC = r"C:\Users\Morgan Brawner\Documents\Claude\Projects\AdventHealth OSS\Pathwaze Data Upload\Pathwaze_Bulk_Upload_AdventHealth_21460.xlsx"
OUT = r"C:\Users\Morgan Brawner\Documents\Pathwaze Local\scripts\_import-data.json"

# Enum guards (mirror DB CHECK constraints / app option lists)
BUILDING_CATEGORY = {"Building", "Parking Lot", "Garage", "Field", "Other"}
METER_STATUS = {"Active", "Inactive", "TBD"}
REVENUE_TYPE = {"Fixed Rate with Escalator", "Fixed Rate", "Indexed", "Avoided Cost"}
SREC = {"Offtaker Retains", "Developer Retains", "REC Arbitrage", "Not Applicable"}


def s(v):
    """Trimmed string or None."""
    if v is None:
        return None
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    out = str(v).strip()
    return out or None


def num(v):
    if v is None or (isinstance(v, str) and not v.strip()):
        return None
    return float(v)


def integer(v):
    n = num(v)
    return int(n) if n is not None else None


def as_date(v):
    if v is None:
        return None
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.strftime("%Y-%m-%d")
    txt = str(v).strip()
    return txt[:10] if txt else None


def boolish(v):
    if v is None:
        return True  # DB default
    return str(v).strip().upper() in ("TRUE", "T", "YES", "Y", "1")


wb = openpyxl.load_workbook(SRC, data_only=True)
warnings = []


def rows(sheet):
    data = list(wb[sheet].iter_rows(values_only=True))
    header = [str(h).strip() if h is not None else "" for h in data[0]]
    for r in data[1:]:
        if all(c is None for c in r):
            continue
        yield dict(zip(header, r))


# ---- Buildings ----
buildings = []
for i, r in enumerate(rows("Buildings (Areas)"), start=2):
    cat = s(r.get("Category")) or "Building"
    if cat not in BUILDING_CATEGORY:
        warnings.append(f"Buildings row {i}: category '{cat}' not in enum -> defaulting to Building")
        cat = "Building"
    buildings.append({
        "project_number": s(r.get("Project")),
        "name": s(r.get("Area Name")),
        "category": cat,
        "parcel_id": s(r.get("Parcel ID")),
        "address": s(r.get("Street Address")),
        "city": s(r.get("City")),
        "state": s(r.get("State")),
        "zip": s(r.get("Zip")),
        "county": s(r.get("County")),
        "owner_name": s(r.get("Owner Name")),
        "ahj": s(r.get("AHJ")),
        "zoning_type": s(r.get("Zoning Type")),
        "land_use_type": s(r.get("Land Use Type")),
        "year_built": integer(r.get("Year Built")),
        "total_sqft": num(r.get("Total Sq Ft")),
        "num_stories": integer(r.get("# Stories")),
        "roof_type": s(r.get("Roof Type")),
        "roof_age": integer(r.get("Roof Age (yrs)")),
        "roof_manufacturer": s(r.get("Roof Manufacturer")),
        "notes": s(r.get("Notes")),
    })
    if not buildings[-1]["name"]:
        warnings.append(f"Buildings row {i}: missing Area Name (required)")
    if not buildings[-1]["parcel_id"]:
        warnings.append(f"Buildings row {i}: missing Parcel ID (upsert key)")

# ---- Meters ----
meters = []
for i, r in enumerate(rows("Meters"), start=2):
    st = s(r.get("Status")) or "Active"
    if st not in METER_STATUS:
        warnings.append(f"Meters row {i}: status '{st}' not in enum -> Active")
        st = "Active"
    meters.append({
        "project_number": s(r.get("Project")),
        "meter_num": s(r.get("Meter #")),
        "account_num": s(r.get("Account #")),
        "utility": s(r.get("Utility")),
        "rate_schedule": s(r.get("Rate Schedule")),
        "annual_usage_kwh": num(r.get("Annual Usage (kWh)")),
        "peak_demand_kw": num(r.get("Peak Demand (kW)")),
        "blended_rate": num(r.get("Blended Rate")),
        "annual_spend": num(r.get("Annual Spend")),
        "status": st,
        "included": boolish(r.get("Included")),
        "ix_app_num": s(r.get("IX Application #")),
        "ix_status": s(r.get("IX Status")),
        "ix_voltage": s(r.get("IX Voltage")),
        "ix_feasibility": s(r.get("IX Feasibility")),
        "ix_cost_estimate": num(r.get("IX Cost Estimate")),
    })
    if not meters[-1]["meter_num"]:
        warnings.append(f"Meters row {i}: missing Meter # (required + upsert key)")

# ---- Offtaker Pricing ----
pricing = []
for i, r in enumerate(rows("Offtaker Pricing"), start=2):
    rev = s(r.get("Revenue Type"))
    if rev and rev not in REVENUE_TYPE:
        warnings.append(f"Pricing row {i}: revenue_type '{rev}' not in enum")
    srec = s(r.get("SREC Treatment"))
    if srec and srec not in SREC:
        warnings.append(f"Pricing row {i}: srec_treatment '{srec}' not in enum")
    pricing.append({
        "project_number": s(r.get("Project")),
        "version_label": s(r.get("Option / Version Label")),
        "revenue_type": rev,
        "term_months": integer(r.get("Contract Term (months)")),
        "year1_contract_price": num(r.get("Year 1 Price")),
        "escalation_rate": num(r.get("Escalation Rate")),
        "utility_escalation_rate": num(r.get("Utility Escalation")),
        "srec_treatment": srec,
        "customer_term_savings": num(r.get("Customer Term Savings")),
        "customer_term_npv": num(r.get("Customer Term NPV")),
        "estimated_ntp": as_date(r.get("Estimated NTP")),
        "estimated_cod": as_date(r.get("Estimated COD")),
        "quote_created_at": as_date(r.get("Quote Created")),
        "notes": s(r.get("Notes")),
        "is_selected": False,
    })
    if not pricing[-1]["version_label"]:
        warnings.append(f"Pricing row {i}: missing Version Label (upsert key)")

out = {"buildings": buildings, "meters": meters, "pricing": pricing, "warnings": warnings}
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, indent=2)

projset = sorted({b["project_number"] for b in buildings}
                 | {m["project_number"] for m in meters}
                 | {p["project_number"] for p in pricing})
print(f"buildings={len(buildings)} meters={len(meters)} pricing={len(pricing)}")
print(f"distinct projects ({len(projset)}): {projset}")
print(f"warnings ({len(warnings)}):")
for w in warnings:
    print("  -", w)
print(f"\nwrote {OUT}")

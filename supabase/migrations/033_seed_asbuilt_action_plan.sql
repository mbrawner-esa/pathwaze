-- Seed the As-Built action plan: Universal questions (synced across a set) plus
-- the discipline checklists. Transcribed from the AdventHealth As-Built Findings
-- Tracker v3. reviewer_hint mirrors the sheet's reviewer key:
--   PM            -> null
--   PM -> Engineer -> 'pm_engineer'
--   Engineer       -> 'engineer'
-- Idempotent: natural-key ON CONFLICT guards allow re-running safely.

-- 1) Plan
insert into public.action_plans (drawing_type, name, version, is_active)
values ('as_built', 'As-Built Review', 1, true)
on conflict (drawing_type, version) do nothing;

-- 2) Sections
insert into public.action_plan_sections (action_plan_id, key, label, is_universal, sort_order)
select p.id, v.key, v.label, v.is_universal, v.sort_order
from public.action_plans p
join (values
  ('universal',     'Universal Questions',                true,  0),
  ('electrical',    'Electrical',                         false, 1),
  ('structural',    'Structural',                         false, 2),
  ('civil',         'Civil / Site',                       false, 3),
  ('mechanical',    'Mechanical / Plumbing',              false, 4),
  ('fire',          'Fire / Life Safety',                 false, 5),
  ('roofing',       'Roofing',                            false, 6),
  ('architectural', 'Architectural',                      false, 7),
  ('hazmat',        'Hazardous Materials / Environmental',false, 8),
  ('telecom',       'Telecom / Low-Voltage / Security',   false, 9),
  ('aquatic',       'Aquatic Systems & Water Bodies',     false, 10)
) as v(key, label, is_universal, sort_order) on true
where p.drawing_type = 'as_built' and p.version = 1
on conflict (action_plan_id, key) do nothing;

-- 3) Items
insert into public.action_plan_items (section_id, sort_order, prompt, hunting_for, reviewer_hint)
select s.id, v.sort_order, v.prompt, v.hunting_for, v.reviewer_hint
from public.action_plan_sections s
join public.action_plans p on p.id = s.action_plan_id and p.drawing_type = 'as_built' and p.version = 1
join (values
  -- ── Universal ──────────────────────────────────────────────────────────
  ('universal', 1,  'How old is this set, and is there a revision history?', 'Stale sets are the #1 source of bad survey scopes. Anything pre-2010 is suspect.', null),
  ('universal', 2,  'Is this stamped ''as-built'' or actually ''issued for construction'' mislabeled?', 'An IFC set frozen at construction start often misses change orders, RFIs, and field fixes.', null),
  ('universal', 3,  'Who was the Engineer of Record, and are they still reachable?', 'EOR availability affects how quickly we can resolve conflicts without a site visit.', null),
  ('universal', 4,  'What is the date of the most recent renovation, and is it reflected in this set?', 'Tenant fit-outs, MEP upgrades, and roof replacements often go undocumented.', null),
  ('universal', 5,  'What is drawn on one sheet that contradicts another sheet?', 'Conflicts between disciplines (e.g., M and E) almost always require field verification.', 'pm_engineer'),
  ('universal', 6,  'What is referenced (''see sheet E-401'') but not actually included in the set?', 'Missing sheets are immediate site-survey items — flag them as Unknown.', null),
  ('universal', 7,  'What equipment is shown that''s likely been replaced in the last 10–15 years?', 'Switchgear, RTUs, transformers — assume replaced until proven otherwise.', 'pm_engineer'),
  ('universal', 8,  'Where are the obvious blank spots — areas of the building with no drawing coverage?', 'Coverage gaps are scope-blind spots. They must be surveyed in person.', null),
  ('universal', 9,  'Are dimensions and elevations consistent across the set?', 'Disagreements in plan vs. section/elevation force field measurement.', 'pm_engineer'),
  ('universal', 10, 'Are there any stamps, legends, or general notes that limit the use of these drawings?', 'EOR notes like ''verify all dimensions in field'' are not boilerplate — they''re a warning.', 'pm_engineer'),
  ('universal', 11, 'Do all disciplines share the same project datum, benchmark, and north arrow?', 'Mismatched datums or north orientation between civil, architectural, and structural is a silent killer — it throws off every coordinate you pull and forces a control survey.', 'pm_engineer'),
  ('universal', 12, 'Is a scale bar present and consistent, or are sheets stamped ''do not scale''?', 'Reproduced or PDF''d sets are frequently rescaled. If you can''t trust the scale, every dimension becomes a field-measure item.', null),
  ('universal', 13, 'Does the as-built package include the redline/closeout record — RFIs, change orders, submittals?', 'A set stamped ''as-built'' without the redline package behind it is just an IFC set with a new stamp. The deviations live in those documents.', null),
  ('universal', 14, 'Does the latest revision date actually post-date the most recent known renovation?', 'If the building was renovated in 2019 and the newest delta is 2014, the set is stale by definition — survey it.', null),
  ('universal', 15, 'Does this set match the building you will actually survey — address, building designation, wing, square footage?', 'On a multi-building campus, pulling the wrong building''s set happens. Confirm the set belongs to the asset before you scope anything.', null),
  ('universal', 16, 'Is there a legend/abbreviations sheet, and are symbols and equipment tags consistent across disciplines?', 'Inconsistent tagging (different names for the same panel on E vs. M) creates phantom conflicts and missed equipment.', null),
  ('universal', 17, 'Is the project manual / specification book available, not just the drawings?', 'The spec book carries equipment ratings, model numbers, and submittal requirements the sheets only reference. Drawings without specs are half a record.', null),

  -- ── Electrical ─────────────────────────────────────────────────────────
  ('electrical', 1,  'Main electrical service size (amps / volts / phase) and configuration documented?', null, null),
  ('electrical', 2,  'Age and location of the main switchgear, MDP, and distribution panels; do they match the one-line?', null, 'pm_engineer'),
  ('electrical', 3,  'Is a current one-line diagram present, and does it reconcile with panel schedules and connected/demand load data?', null, 'pm_engineer'),
  ('electrical', 4,  'Specification sheets and panel schedules available for all main electrical equipment?', null, null),
  ('electrical', 5,  'Busbar ratings, main breaker sizes, and spare breaker/space availability documented at major panels and switchgear?', null, 'engineer'),
  ('electrical', 6,  'Utility meter(s) and transformer(s) shown with location, ownership, and ID numbers?', null, 'pm_engineer'),
  ('electrical', 7,  'Serving utility and service-entrance / metering configuration documented?', null, 'pm_engineer'),
  ('electrical', 8,  'Existing on-site generation, ATS, and paralleling switchgear documented?', null, 'pm_engineer'),
  ('electrical', 9,  'Is the Essential Electrical System and its branches (life-safety / critical / equipment) identified on the one-line (NEC 517.30 / NFPA 99)?', null, 'engineer'),
  ('electrical', 10, 'Available fault current / AIC ratings and SCCR documented?', null, 'engineer'),
  ('electrical', 11, 'Arc flash labels present, and is the arc flash / short-circuit / coordination study current (within 5 years)?', null, 'pm_engineer'),
  ('electrical', 12, 'Grounding and bonding system documentation present (electrodes, ground ring)?', null, 'pm_engineer'),
  ('electrical', 13, 'Lightning / surge protection system documented?', null, 'pm_engineer'),
  ('electrical', 14, 'Working clearances at electrical rooms and equipment shown and compliant (NEC 110.26)?', null, 'engineer'),
  ('electrical', 15, 'Spare conduit, cable tray, and routing/chase pathways documented?', null, 'pm_engineer'),
  ('electrical', 16, 'Any references to outdated electrical codes (NEC edition) in the notes?', null, 'engineer'),
  ('electrical', 17, 'Any references to missing or ''not in contract'' sheets and details?', null, null),

  -- ── Structural ─────────────────────────────────────────────────────────
  ('structural', 1,  'Roof construction type (steel bar joist, wood truss, concrete tee, etc.) and span?', null, 'engineer'),
  ('structural', 2,  'Design dead load and live load (plus roof live / collateral) per the structural general notes?', null, 'engineer'),
  ('structural', 3,  'Existing rooftop equipment locations, weights, and tie-down/curb details?', null, 'engineer'),
  ('structural', 4,  'Roof membrane type, age, warranty status, and warranty holder? (cross-ref Roofing)', null, null),
  ('structural', 5,  'Parapet height, edge conditions, and roof access (interior hatch vs. exterior ladder)?', null, null),
  ('structural', 6,  'Seismic, hurricane, or special wind-zone provisions stamped in the notes (Vult, exposure category, HVHZ)?', null, 'engineer'),
  ('structural', 7,  'Governing building code edition and Risk Category stated (hospitals = Risk Category IV)?', null, null),
  ('structural', 8,  'Existing structural calculations or documented reserve capacity available?', null, 'pm_engineer'),
  ('structural', 9,  'Existing penetrations, expansion joints, and drains shown?', null, 'pm_engineer'),
  ('structural', 10, 'Soil bearing / geotechnical report available (for any existing or new foundations)?', null, null),
  ('structural', 11, 'Ponding history, camber/deflection, or known structural distress noted?', null, 'pm_engineer'),
  ('structural', 12, 'Vibration-sensitive spaces or equipment (OR, MRI) below the structure identified?', null, 'pm_engineer'),
  ('structural', 13, 'Is a recent structural condition assessment available?', null, null),

  -- ── Civil / Site ───────────────────────────────────────────────────────
  ('civil', 1,  'Underground utility routing (electrical, water, sewer, gas, fiber) documented?', null, null),
  ('civil', 2,  'Site drainage, retention/detention features, and any associated easements?', null, null),
  ('civil', 3,  'Property line, setbacks, and any recorded easements affecting the site?', null, null),
  ('civil', 4,  'Existing parking, drive aisles, and fire lanes shown?', null, null),
  ('civil', 5,  'Site lighting circuits and locations documented?', null, null),
  ('civil', 6,  'Stormwater management permitting history and any wetland/floodplain overlay?', null, null),
  ('civil', 7,  'Geotechnical report availability?', null, null),
  ('civil', 8,  'ADA specifications shown and designed under current code?', null, null),
  ('civil', 9,  'Existing fence lines, gates, and security infrastructure routing?', null, null),
  ('civil', 10, 'Current topographic / ALTA survey and benchmark/datum available and useable?', null, 'pm_engineer'),
  ('civil', 11, 'Existing duct banks, manholes, and handholes shown?', null, null),
  ('civil', 12, 'FEMA flood zone and base flood elevation identified?', null, 'pm_engineer'),
  ('civil', 13, 'Helipad / heliport and FAA Part 77 approach surfaces shown (if applicable)?', null, 'pm_engineer'),
  ('civil', 14, 'Emergency-vehicle / ambulance / ER access routes shown?', null, null),
  ('civil', 15, 'Parking-lot specification (asphalt/base/subbase; striping; ADA stalls; signage; curb/ramp details) in the set?', null, null),

  -- ── Mechanical / Plumbing ──────────────────────────────────────────────
  ('mechanical', 1, 'Rooftop unit locations, sizes, and required service clearances shown?', null, null),
  ('mechanical', 2, 'Full RTU/AHU inventory with ages documented?', null, null),
  ('mechanical', 3, 'Infectious / isolation-room exhaust, lab, and kitchen exhaust terminations identified?', null, null),
  ('mechanical', 4, 'Medical gas, bulk oxygen, and vacuum vent terminations on the roof identified (NFPA 99)?', null, null),
  ('mechanical', 5, 'Cooling tower, chiller, and generator radiator locations shown?', null, null),
  ('mechanical', 6, 'Gas lines, refrigerant lines, and condensate routing across the roof shown?', null, null),
  ('mechanical', 7, 'Future-planned equipment or rooftop additions noted on the M sheets?', null, null),

  -- ── Fire / Life Safety ─────────────────────────────────────────────────
  ('fire', 1, 'Fire alarm panel location and system documentation present?', null, null),
  ('fire', 2, 'Hazardous materials, oxygen storage, or medical-gas zones identified?', null, null),
  ('fire', 3, 'Standpipe and roof hydrant locations shown?', null, null),
  ('fire', 4, 'Group I-2 occupancy / construction type and fire-rated assemblies identified (firestopping)?', null, 'pm_engineer'),
  ('fire', 5, 'Sprinkler coverage and system documentation present?', null, null),
  ('fire', 6, 'AHJ identity — local fire marshal, State Fire Marshal, and AHCA — identified?', null, null),

  -- ── Roofing ────────────────────────────────────────────────────────────
  ('roofing', 1, 'Manufacturer, system type, and assembly buildup of the existing roof?', null, 'pm_engineer'),
  ('roofing', 2, 'Original install date, warranty term, and warranty holder of record?', null, null),
  ('roofing', 3, 'Past leak history, patches, and any pending warranty claims?', null, null),
  ('roofing', 4, 'Warranty restrictions affecting rooftop work?', null, null),

  -- ── Architectural ──────────────────────────────────────────────────────
  ('architectural', 1, 'Non-public / sensitive areas (patient rooms, MRI suites, ORs, NICU, pharmacy, data/server rooms) identified?', null, null),
  ('architectural', 2, 'Existing signage, screening, and exterior aesthetic requirements?', null, null),
  ('architectural', 3, 'Occupancy classification (Group I-2) and construction type stated?', null, null),
  ('architectural', 4, 'Vibration / EMI-sensitive zones (MRI magnetic/RF, imaging) identified?', null, null),
  ('architectural', 5, 'Existing rooftop walkways, fall-protection anchors, and guardrails documented?', null, null),
  ('architectural', 6, 'Historic or design-review and exterior aesthetic standards applicable?', null, null),

  -- ── Hazardous Materials / Environmental ────────────────────────────────
  ('hazmat', 1, 'Asbestos and lead survey records for the building''s vintage available?', null, 'pm_engineer'),
  ('hazmat', 2, 'PCB-containing equipment in older transformers / ballasts noted?', null, 'engineer'),
  ('hazmat', 3, 'Medical / biohazard, oxygen, and medical-gas zones identified (NFPA 99)?', null, 'pm_engineer'),
  ('hazmat', 4, 'Stormwater, wetland, floodplain, and protected-species constraints documented?', null, 'pm_engineer'),

  -- ── Telecom / Low-Voltage / Security ───────────────────────────────────
  ('telecom', 1, 'Existing rooftop antennas, microwave, paging, two-way radio, or DAS documented?', null, null),
  ('telecom', 2, 'Security / CCTV, card access, and perimeter systems documented?', null, null),
  ('telecom', 3, 'Lightning protection and grounding system documented?', null, 'pm_engineer'),
  ('telecom', 4, 'Communications / IT rooms and main pathways identified?', null, 'pm_engineer'),

  -- ── Aquatic Systems & Water Bodies ─────────────────────────────────────
  ('aquatic', 1, 'Ownership rights, easements, and ROW documents present?', null, null),
  ('aquatic', 2, 'Existing aquatic equipment drawings available (fountains, submerged utilities, etc)?', null, 'pm_engineer'),
  ('aquatic', 3, 'Original pond design drawings available (embankment construction, depth, outlets, etc)?', null, 'pm_engineer')
) as v(section_key, sort_order, prompt, hunting_for, reviewer_hint) on v.section_key = s.key
on conflict (section_id, sort_order) do nothing;

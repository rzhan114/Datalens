"""
DataLens Job Market Dataset Generator
======================================
Synthesizes a realistic job listings dataset based on:
  - Kaggle ds_salaries public dataset salary ranges
  - BLS Occupational Employment Statistics (2019-2023)
  - Glassdoor / levels.fyi aggregated acceptance rate reports

Output: data/jobs_market.zip
  └── listings/
        ├── tech.json
        ├── finance.json
        ├── healthcare.json
        ├── consulting.json
        └── ecommerce.json

Each JSON has the shape expected by SectionHelper:
  { "result": [ { id, JobId, Role, Company, Industry, Year,
                  Salary, Applicants, Rejections, Openings }, ... ] }

Usage:
  python3 scripts/generate_dataset.py
"""

import json
import random
import zipfile
import os
from dataclasses import dataclass, asdict
from typing import List

random.seed(42)  # reproducible

# ─── Data Definitions ────────────────────────────────────────────────────────

@dataclass
class ListingTemplate:
    industry: str
    company: str
    role: str
    job_id: str
    # salary range $K, acceptance rate %, avg openings per year
    salary_min: int
    salary_max: int
    acceptance_rate: float   # openings / applicants
    base_applicants: int     # per year
    base_openings: int       # per year

TEMPLATES: List[ListingTemplate] = [
    # ── Tech ──────────────────────────────────────────────────────────────────
    ListingTemplate("Tech", "Google",    "Software Engineer",     "SWE-L3",  155, 210, 0.008, 85000, 700),
    ListingTemplate("Tech", "Google",    "ML Engineer",           "MLE-L4",  175, 230, 0.006, 40000, 250),
    ListingTemplate("Tech", "Google",    "Data Scientist",        "DS-L4",   160, 215, 0.007, 30000, 200),
    ListingTemplate("Tech", "Meta",      "Software Engineer",     "SWE-E4",  160, 220, 0.009, 70000, 630),
    ListingTemplate("Tech", "Meta",      "ML Engineer",           "MLE-E5",  180, 240, 0.005, 25000, 130),
    ListingTemplate("Tech", "Meta",      "Product Manager",       "PM-IC4",  155, 205, 0.012, 18000, 220),
    ListingTemplate("Tech", "Amazon",    "Software Engineer",     "SWE-SDE2",140, 195, 0.010, 95000, 950),
    ListingTemplate("Tech", "Amazon",    "Data Engineer",         "DE-L5",   135, 185, 0.015, 22000, 330),
    ListingTemplate("Tech", "Amazon",    "Product Manager",       "PM-L5",   145, 195, 0.013, 15000, 195),
    ListingTemplate("Tech", "Microsoft", "Software Engineer",     "SWE-SDE2",145, 200, 0.011, 75000, 825),
    ListingTemplate("Tech", "Microsoft", "Data Scientist",        "DS-L61",  150, 200, 0.009, 18000, 162),
    ListingTemplate("Tech", "Microsoft", "Cloud Engineer",        "CE-L62",  140, 195, 0.013, 20000, 260),
    ListingTemplate("Tech", "Apple",     "Software Engineer",     "SWE-ICT3",160, 220, 0.007, 50000, 350),
    ListingTemplate("Tech", "Apple",     "ML Engineer",           "MLE-ICT4",175, 235, 0.005, 15000,  75),
    ListingTemplate("Tech", "Netflix",   "Software Engineer",     "SWE-L5",  185, 250, 0.004, 20000,  80),
    ListingTemplate("Tech", "Netflix",   "Data Scientist",        "DS-L5",   175, 240, 0.004, 10000,  40),
    ListingTemplate("Tech", "Stripe",    "Software Engineer",     "SWE-L3",  170, 230, 0.006, 18000, 108),
    ListingTemplate("Tech", "Airbnb",    "Software Engineer",     "SWE-L4",  165, 225, 0.007, 15000, 105),
    ListingTemplate("Tech", "Uber",      "Software Engineer",     "SWE-L4",  155, 210, 0.009, 22000, 198),
    ListingTemplate("Tech", "Uber",      "Data Scientist",        "DS-L4",   150, 205, 0.010, 12000, 120),
    # ── Finance ───────────────────────────────────────────────────────────────
    ListingTemplate("Finance", "JPMorgan",       "Software Engineer",    "SWE-VP",  130, 185, 0.018, 45000, 810),
    ListingTemplate("Finance", "JPMorgan",       "Quantitative Analyst", "QA-VP",   140, 200, 0.010, 12000, 120),
    ListingTemplate("Finance", "JPMorgan",       "Data Analyst",         "DA-AVP",  100, 145, 0.025, 20000, 500),
    ListingTemplate("Finance", "Goldman Sachs",  "Software Engineer",    "SWE-VP",  145, 200, 0.012, 30000, 360),
    ListingTemplate("Finance", "Goldman Sachs",  "Quantitative Analyst", "QA-MD",   160, 230, 0.007, 8000,   56),
    ListingTemplate("Finance", "Goldman Sachs",  "Risk Analyst",         "RA-AVP",  110, 155, 0.020, 10000, 200),
    ListingTemplate("Finance", "Morgan Stanley", "Software Engineer",    "SWE-VP",  135, 190, 0.015, 25000, 375),
    ListingTemplate("Finance", "Morgan Stanley", "Data Scientist",       "DS-ED",   140, 195, 0.012, 8000,   96),
    ListingTemplate("Finance", "Citadel",        "Quantitative Analyst", "QA-SR",   200, 300, 0.003, 5000,   15),
    ListingTemplate("Finance", "Citadel",        "Software Engineer",    "SWE-SR",  185, 270, 0.004, 4000,   16),
    ListingTemplate("Finance", "Jane Street",    "Quantitative Trader",  "QT-SR",   250, 400, 0.002, 3000,    6),
    ListingTemplate("Finance", "Jane Street",    "Software Engineer",    "SWE-SR",  200, 300, 0.003, 2500,    8),
    ListingTemplate("Finance", "Bloomberg",      "Software Engineer",    "SWE-L4",  140, 190, 0.016, 18000, 288),
    ListingTemplate("Finance", "Bloomberg",      "Data Engineer",        "DE-L4",   130, 175, 0.020, 8000,  160),
    # ── Healthcare ────────────────────────────────────────────────────────────
    ListingTemplate("Healthcare", "UnitedHealth",  "Data Analyst",          "DA-SR",   90, 130, 0.030, 15000, 450),
    ListingTemplate("Healthcare", "UnitedHealth",  "Software Engineer",     "SWE-SR",  120, 165, 0.022, 12000, 264),
    ListingTemplate("Healthcare", "UnitedHealth",  "Data Scientist",        "DS-SR",   115, 160, 0.025, 8000,  200),
    ListingTemplate("Healthcare", "Johnson & Johnson", "Data Scientist",    "DS-SR",   110, 155, 0.028, 7000,  196),
    ListingTemplate("Healthcare", "Johnson & Johnson", "ML Engineer",       "MLE-SR",  125, 170, 0.020, 4000,   80),
    ListingTemplate("Healthcare", "Pfizer",        "Data Analyst",          "DA-SR",   85, 125, 0.035, 10000, 350),
    ListingTemplate("Healthcare", "Pfizer",        "Data Scientist",        "DS-SR",   110, 150, 0.028, 5000,  140),
    ListingTemplate("Healthcare", "CVS Health",    "Software Engineer",     "SWE-SR",  110, 155, 0.025, 9000,  225),
    ListingTemplate("Healthcare", "CVS Health",    "Data Engineer",         "DE-SR",   105, 145, 0.030, 5000,  150),
    ListingTemplate("Healthcare", "Humana",        "Data Analyst",          "DA-SR",   80, 120, 0.038, 6000,  228),
    # ── Consulting ────────────────────────────────────────────────────────────
    ListingTemplate("Consulting", "McKinsey",   "Data Scientist",        "DS-EM",   130, 180, 0.015, 8000,  120),
    ListingTemplate("Consulting", "McKinsey",   "Software Engineer",     "SWE-EM",  120, 165, 0.018, 5000,   90),
    ListingTemplate("Consulting", "BCG",        "Data Scientist",        "DS-C",    125, 175, 0.016, 7000,  112),
    ListingTemplate("Consulting", "BCG",        "ML Engineer",           "MLE-C",   135, 185, 0.014, 3500,   49),
    ListingTemplate("Consulting", "Deloitte",   "Data Analyst",          "DA-SR",   90, 130, 0.035, 20000, 700),
    ListingTemplate("Consulting", "Deloitte",   "Software Engineer",     "SWE-SR",  110, 155, 0.028, 15000, 420),
    ListingTemplate("Consulting", "Deloitte",   "Data Scientist",        "DS-SR",   115, 160, 0.025, 10000, 250),
    ListingTemplate("Consulting", "Accenture",  "Software Engineer",     "SWE-L8",  105, 150, 0.030, 25000, 750),
    ListingTemplate("Consulting", "Accenture",  "Data Engineer",         "DE-L8",   100, 145, 0.032, 12000, 384),
    ListingTemplate("Consulting", "PwC",        "Data Analyst",          "DA-SR",   85, 125, 0.040, 14000, 560),
    ListingTemplate("Consulting", "PwC",        "Software Engineer",     "SWE-SR",  100, 145, 0.033, 10000, 330),
    # ── E-commerce ────────────────────────────────────────────────────────────
    ListingTemplate("E-commerce", "Shopify",  "Software Engineer",     "SWE-SR",  140, 195, 0.012, 18000, 216),
    ListingTemplate("E-commerce", "Shopify",  "Data Scientist",        "DS-SR",   135, 185, 0.014, 8000,  112),
    ListingTemplate("E-commerce", "eBay",     "Software Engineer",     "SWE-L4",  130, 180, 0.015, 15000, 225),
    ListingTemplate("E-commerce", "eBay",     "Data Engineer",         "DE-L4",   125, 170, 0.018, 7000,  126),
    ListingTemplate("E-commerce", "Etsy",     "Software Engineer",     "SWE-SR",  130, 180, 0.016, 8000,  128),
    ListingTemplate("E-commerce", "Etsy",     "Data Scientist",        "DS-SR",   125, 175, 0.018, 4000,   72),
    ListingTemplate("E-commerce", "Wayfair",  "Software Engineer",     "SWE-SR",  120, 170, 0.020, 10000, 200),
    ListingTemplate("E-commerce", "Wayfair",  "Data Analyst",          "DA-SR",   95, 135, 0.030, 6000,  180),
    ListingTemplate("E-commerce", "DoorDash", "Software Engineer",     "SWE-L5",  155, 210, 0.010, 12000, 120),
    ListingTemplate("E-commerce", "DoorDash", "ML Engineer",           "MLE-L5",  165, 225, 0.008, 5000,   40),
    ListingTemplate("E-commerce", "Instacart","Software Engineer",     "SWE-SR",  140, 195, 0.013, 7000,   91),
]

YEARS = [2019, 2020, 2021, 2022, 2023]

# Year-over-year multipliers (reflects market trends)
YEAR_SALARY_MULT   = {2019: 0.82, 2020: 0.87, 2021: 0.95, 2022: 1.08, 2023: 1.00}
YEAR_DEMAND_MULT   = {2019: 0.75, 2020: 0.70, 2021: 0.90, 2022: 1.10, 2023: 1.00}
# 2020 dip = COVID hiring freeze; 2021-2022 surge; 2023 normalisation


# ─── Generator ───────────────────────────────────────────────────────────────

def generate_listings() -> dict:
    """Returns { industry: [listing_dict, ...] }"""
    by_industry: dict = {}
    uid = 1

    for tmpl in TEMPLATES:
        for year in YEARS:
            salary_mult  = YEAR_SALARY_MULT[year]
            demand_mult  = YEAR_DEMAND_MULT[year]

            # Add ±8% noise to salary and demand
            noise_s = random.uniform(0.92, 1.08)
            noise_d = random.uniform(0.88, 1.12)

            avg_salary   = round(
                random.uniform(tmpl.salary_min, tmpl.salary_max) * salary_mult * noise_s, 1
            )
            applicants   = max(50, int(tmpl.base_applicants * demand_mult * noise_d))
            openings     = max(1,  int(tmpl.base_openings   * demand_mult * noise_d))
            rejections   = max(0,  applicants - openings)

            record = {
                "id":         str(uid),
                "JobId":      tmpl.job_id,
                "Role":       tmpl.role,
                "Company":    tmpl.company,
                "Industry":   tmpl.industry,
                "Year":       year,
                "Salary":     avg_salary,
                "Applicants": applicants,
                "Rejections": rejections,
                "Openings":   openings,
            }

            if tmpl.industry not in by_industry:
                by_industry[tmpl.industry] = []
            by_industry[tmpl.industry].append(record)
            uid += 1

    return by_industry


# ─── ZIP writer ──────────────────────────────────────────────────────────────

def write_zip(by_industry: dict, output_path: str) -> None:
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for industry, listings in by_industry.items():
            filename = industry.lower().replace("/", "_").replace("-", "_").replace(" ", "_")
            content  = json.dumps({"result": listings}, indent=2)
            zf.writestr(f"listings/{filename}.json", content)

    total = sum(len(v) for v in by_industry.values())
    print(f"✓ Created {output_path}")
    print(f"  Industries : {len(by_industry)}")
    print(f"  Companies  : {len({t.company for t in TEMPLATES})}")
    print(f"  Total rows : {total}")
    for ind, lst in sorted(by_industry.items()):
        print(f"    {ind:<15} {len(lst):>4} listings")


# ─── Entry point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    output = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "data", "jobs_market.zip"
    )
    by_industry = generate_listings()
    write_zip(by_industry, output)
    print("\nNext step:")
    print(f"  curl -X PUT 'http://localhost:1220/api/v1/dataset/jobs' \\")
    print(f"    -H \"Authorization: Bearer $TOKEN\" \\")
    print(f"    -H 'Content-Type: application/zip' \\")
    print(f"    --data-binary @{output}")

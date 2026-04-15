"""
test_form_pipeline.py

Tests the form intake → email auto-reply pipeline (Workflow 06).
Fires a simulated form submission at the n8n webhook and checks the response.

Usage:
    python tools/test_form_pipeline.py                              # Fire demo form submission
    python tools/test_form_pipeline.py --email you@example.com      # Use specific email
    python tools/test_form_pipeline.py --live                       # demo_mode=false (sends real email)

Requires in .env:
    N8N_WEBHOOK_FORM_INTAKE=http://localhost:5678/webhook/form-intake
    COMPANY_ID=<uuid from companies table>  (optional — defaults to empty)
"""

import argparse
import json
import sys

import requests
from dotenv import load_dotenv
import os

load_dotenv()

WEBHOOK_URL = os.getenv("N8N_WEBHOOK_FORM_INTAKE", "http://localhost:5678/webhook/form-intake")
COMPANY_ID = os.getenv("COMPANY_ID", "")

DEMO_LEADS = [
    {
        "first_name": "Marie",
        "last_name": "Tremblay",
        "phone": "+15145550201",
        "email": "marie.tremblay@example.com",
        "vehicle_interest": "2024 Toyota Camry LE",
        "message": "Hi, I saw this car on your website. Is it still available? I'd like to come see it this weekend.",
    },
    {
        "first_name": "Jean-Pierre",
        "last_name": "Bouchard",
        "phone": "+15145550202",
        "email": "jp.bouchard@example.com",
        "vehicle_interest": "",
        "message": "Looking for a reliable family SUV under $35k. What do you have?",
    },
    {
        "first_name": "Sarah",
        "last_name": "Chen",
        "phone": "+15145550203",
        "email": "sarah.chen@example.com",
        "vehicle_interest": "2023 Honda Civic Sport",
        "message": "",
    },
]


def fire_lead(lead_data, company_id, live=False):
    payload = {
        **lead_data,
        "company_id": company_id or COMPANY_ID,
        "source": "website_form",
    }

    print(f"\n--- Submitting: {lead_data['first_name']} {lead_data['last_name']} ({lead_data['email']}) ---")
    print(f"  Webhook: {WEBHOOK_URL}")
    print(f"  Vehicle: {lead_data.get('vehicle_interest') or '(general inquiry)'}")
    print(f"  Company ID: {payload['company_id'] or '(none)'}")

    try:
        resp = requests.post(WEBHOOK_URL, json=payload, timeout=30)
        print(f"  Status: {resp.status_code}")
        try:
            body = resp.json()
            print(f"  Response: {json.dumps(body, indent=2)}")
        except Exception:
            print(f"  Response: {resp.text[:500]}")

        if resp.status_code == 200:
            print("  Result: SUCCESS")
        elif resp.status_code == 400:
            print("  Result: VALIDATION ERROR")
        else:
            print(f"  Result: UNEXPECTED ({resp.status_code})")

    except requests.exceptions.ConnectionError:
        print("  ERROR: Cannot connect to n8n. Is it running at the webhook URL?")
        sys.exit(1)
    except requests.exceptions.Timeout:
        print("  ERROR: Request timed out (30s). The workflow may be hanging.")


def main():
    parser = argparse.ArgumentParser(description="Test WF06 form intake pipeline")
    parser.add_argument("--all", action="store_true", help="Fire all 3 demo leads")
    parser.add_argument("--email", type=str, help="Override email address")
    parser.add_argument("--company-id", type=str, help="Override company UUID")
    parser.add_argument("--live", action="store_true", help="Set demo_mode=false")
    args = parser.parse_args()

    if not WEBHOOK_URL:
        print("ERROR: N8N_WEBHOOK_FORM_INTAKE not set in .env")
        sys.exit(1)

    company_id = args.company_id or COMPANY_ID

    if args.all:
        for lead in DEMO_LEADS:
            fire_lead(lead, company_id, args.live)
    else:
        lead = DEMO_LEADS[0].copy()
        if args.email:
            lead["email"] = args.email
        fire_lead(lead, company_id, args.live)


if __name__ == "__main__":
    main()

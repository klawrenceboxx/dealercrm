"""
simulate_lead.py

Fires a simulated car dealership lead at the n8n Workflow 01 (Lead Intake) webhook.
Used for demo and testing — no real website form or Meta account needed.

Usage:
    python tools/simulate_lead.py                        # Fire first demo lead (demo mode)
    python tools/simulate_lead.py --all                  # Fire all 3 demo leads
    python tools/simulate_lead.py --source meta          # Meta lead source
    python tools/simulate_lead.py --phone "+15141234567" --vehicle "2023 Honda Civic"
    python tools/simulate_lead.py --live                 # Set demo_mode=false (sends real SMS)

Requires in .env:
    N8N_WEBHOOK_INTAKE=https://...
"""

import argparse
import uuid
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv
import os

load_dotenv()

WEBHOOK_URL = os.getenv("N8N_WEBHOOK_INTAKE")

# 3 realistic Quebec car buyer demo leads
DEMO_LEADS = [
    {
        "first_name": "James",
        "last_name": "Tremblay",
        "phone": "+15145550101",
        "email": "james.tremblay@demo.com",
        "vehicle_interest": "2024 Toyota Camry LE",
        "source": "website",
    },
    {
        "first_name": "Sophie",
        "last_name": "Bergeron",
        "phone": "+15145550102",
        "email": "sophie.bergeron@demo.com",
        "vehicle_interest": "2023 Honda Civic Sport",
        "source": "meta",
    },
    {
        "first_name": "Marc",
        "last_name": "Lavoie",
        "phone": "+15145550103",
        "email": "marc.lavoie@demo.com",
        "vehicle_interest": "",  # no vehicle interest — tests fallback behavior
        "source": "website",
    },
]


def fire_lead(lead: dict, demo_mode: bool = True) -> dict:
    payload = {
        **lead,
        "demo_mode": demo_mode,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "test_id": str(uuid.uuid4())[:8],
    }
    try:
        r = requests.post(WEBHOOK_URL, json=payload, timeout=15)
        return {"status": r.status_code, "name": lead["first_name"], "body": r.text[:120]}
    except requests.exceptions.ConnectionError:
        return {"status": "ERROR", "name": lead["first_name"], "body": "Connection failed — is n8n running?"}
    except requests.exceptions.Timeout:
        return {"status": "TIMEOUT", "name": lead["first_name"], "body": "Request timed out"}


def main():
    parser = argparse.ArgumentParser(description="Fire a test lead at the n8n intake webhook")
    parser.add_argument("--source", choices=["website", "meta"], default="website", help="Lead source")
    parser.add_argument("--phone", default=None, help="Custom phone number (E.164: +15141234567)")
    parser.add_argument("--vehicle", default=None, help='Vehicle interest (e.g. "2024 Toyota Camry")')
    parser.add_argument("--all", action="store_true", dest="fire_all", help="Fire all 3 demo leads")
    parser.add_argument("--live", action="store_true", help="Set demo_mode=false — sends real SMS via Twilio")
    args = parser.parse_args()

    if not WEBHOOK_URL:
        print("ERROR: N8N_WEBHOOK_INTAKE not set in .env")
        print("Set it after creating Workflow 01 in n8n.")
        return

    # Build the list of leads to fire
    if args.phone or args.vehicle:
        leads = [
            {
                "first_name": "Test",
                "last_name": "Lead",
                "phone": args.phone or "+15145550199",
                "email": "test@demo.com",
                "vehicle_interest": args.vehicle or "",
                "source": args.source,
            }
        ]
    elif args.fire_all:
        leads = DEMO_LEADS
    else:
        leads = [DEMO_LEADS[0]]

    demo_mode = not args.live
    mode_label = "DEMO" if demo_mode else "LIVE"
    print(f"Firing {len(leads)} lead(s) [{mode_label} mode]...")

    for lead in leads:
        result = fire_lead(lead, demo_mode=demo_mode)
        status = result["status"]
        icon = "OK" if status == 200 else "!!"
        print(f"[{icon}] {result['name']} ({lead['source']}) — HTTP {status} — {result['body']}")

    print("\nCheck n8n execution log and Airtable Leads table to verify.")


if __name__ == "__main__":
    main()

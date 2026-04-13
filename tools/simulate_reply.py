"""
simulate_reply.py

Simulates an inbound SMS reply from a lead to test Workflow 03 (Inbound SMS Handler).
Mimics the exact Twilio webhook payload format — so n8n treats it like a real inbound text.

A "hot" message (e.g. "I want to buy now") should:
  1. Trigger WF03 to log the inbound, call Claude, classify as hot
  2. WF03 posts to WF05 (Hot Lead Alert) — SMS + email to salesperson

Usage:
    python tools/simulate_reply.py                        # James Tremblay, default hot message
    python tools/simulate_reply.py --phone "+15145550102" # Sophie's number
    python tools/simulate_reply.py --message "What's the price on the Camry?"
    python tools/simulate_reply.py --phone "+16476321709" --message "I want to buy now"

Requires in .env:
    N8N_WEBHOOK_INBOUND=https://...   (Workflow 03 webhook URL)
"""

import argparse
import os

import requests
from dotenv import load_dotenv

load_dotenv()

WEBHOOK_URL = os.getenv("N8N_WEBHOOK_INBOUND")

# James Tremblay — the default demo lead from simulate_lead.py
DEFAULT_PHONE = "+16476321709"
DEFAULT_MESSAGE = "I want to buy now"


def fire_reply(from_phone: str, body: str) -> dict:
    # Twilio inbound webhook payload format
    payload = {
        "From": from_phone,
        "Body": body,
        "To": os.getenv("TWILIO_FROM_NUMBER", ""),  # dealership number — optional, WF03 may not need it
        "NumMedia": "0",
        "MessageSid": "SIMULATEDxxxxxxxxxxxxxxxxxxxxxxxx",
    }
    try:
        r = requests.post(WEBHOOK_URL, json=payload, timeout=15)
        return {"status": r.status_code, "body": r.text[:200]}
    except requests.exceptions.ConnectionError:
        return {"status": "ERROR", "body": "Connection failed — is n8n running?"}
    except requests.exceptions.Timeout:
        return {"status": "TIMEOUT", "body": "Request timed out"}


def main():
    parser = argparse.ArgumentParser(description="Simulate an inbound SMS reply to test WF03 + WF05")
    parser.add_argument("--phone", default=DEFAULT_PHONE, help=f"Lead phone (E.164). Default: {DEFAULT_PHONE} (James)")
    parser.add_argument("--message", default=DEFAULT_MESSAGE, help=f'SMS body. Default: "{DEFAULT_MESSAGE}"')
    args = parser.parse_args()

    if not WEBHOOK_URL:
        print("ERROR: N8N_WEBHOOK_INBOUND not set in .env")
        print("Grab the WF03 webhook URL from n8n and add it:")
        print("  N8N_WEBHOOK_INBOUND=https://your-n8n.com/webhook/wf03-inbound")
        return

    print(f"Sending inbound reply...")
    print(f"  From:    {args.phone}")
    print(f"  Message: {args.message}")
    print(f"  To:      {WEBHOOK_URL}")

    result = fire_reply(args.phone, args.message)
    status = result["status"]
    icon = "OK" if status == 200 else "!!"
    print(f"\n[{icon}] HTTP {status} — {result['body']}")

    if status == 200:
        print("\nExpect in n8n:")
        print("  WF03 — inbound logged, Claude classifies intent")
        print("  WF05 — hot lead alert SMS + email (if classified as hot)")
        print("\nVerify in Supabase: sms_log table for new inbound row, lead stage updated")
    else:
        print("\nCheck that n8n is running and WF03 webhook is active (not test mode).")


if __name__ == "__main__":
    main()

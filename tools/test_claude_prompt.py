"""
test_claude_prompt.py

Test the dealership AI SMS prompt locally before wiring it into n8n.
Use this to iterate on message copy and intent classification quality
without running any live workflows.

Usage:
    python tools/test_claude_prompt.py                              # first_contact, default lead
    python tools/test_claude_prompt.py --trigger follow_up_day3
    python tools/test_claude_prompt.py --trigger inbound_reply --reply "What's the price?"
    python tools/test_claude_prompt.py --vehicle "2023 Honda Civic" --trigger first_contact
    python tools/test_claude_prompt.py --all                        # test all 5 trigger types

Requires in .env:
    ANTHROPIC_API_KEY=...
"""

import argparse
import json
import os

import anthropic
from dotenv import load_dotenv

load_dotenv()

# ── Prompt config ──────────────────────────────────────────────────────────────
# These match what's hardcoded in n8n Workflow 02 (AI SMS Engine).
# When you update one, update both.

DEALERSHIP_NAME = "Demo Motors"
DEALERSHIP_CITY = "Montreal, QC"
SALESPERSON_NAME = "Alex"
SALESPERSON_PHONE = "+15145550000"
DEALERSHIP_HOURS = "Mon-Sat 9am-6pm ET"

DEMO_INVENTORY = """
2024 Toyota Camry LE — Silver — 12,000 km — $29,900
2023 Honda Civic Sport — Black — 18,500 km — $27,400
2025 Nissan Rogue SV — White — New — $38,200
2022 Hyundai Tucson Preferred — Red — 31,000 km — $29,500
2024 Ford F-150 XLT — Blue — 8,200 km — $52,000
"""

SYSTEM_PROMPT = f"""You are an AI assistant for {DEALERSHIP_NAME} in {DEALERSHIP_CITY}.
Sales contact: {SALESPERSON_NAME}, {SALESPERSON_PHONE}
Hours: {DEALERSHIP_HOURS}

CURRENT AVAILABLE INVENTORY:
{DEMO_INVENTORY.strip()}

RULES:
- SMS under 160 characters unless the content truly requires more
- Professional but warm — not pushy, not robotic
- Never use em dashes
- No filler phrases ("Great question!", "Certainly!", "Of course!")
- Always include a clear next step or question
- Sign with salesperson first name on first contact only
- Never lie about inventory availability
- Respect STOP/UNSUBSCRIBE requests immediately

OUTPUT FORMAT: JSON only — no other text before or after.
{{
  "sms_text": "the message to send",
  "intent_score": "hot|warm|cold",
  "intent_reasoning": "1-sentence explanation"
}}

INTENT DEFINITIONS:
hot: asking for price/availability, wants test drive, ready to buy soon
warm: engaged and asking questions, comparing options, needs nurturing
cold: no reply yet, vague interest, or generic first inquiry"""

TRIGGER_INSTRUCTIONS = {
    "first_contact": "This is the very first message. Introduce yourself briefly, reference their vehicle interest if provided, ask one qualifying question. Sign with your first name.",
    "follow_up_day3": "Lead has not replied in 3 days. Short, friendly check-in. One question only. Keep it under 100 characters if possible.",
    "follow_up_day7": "No reply in 7 days. Try a different angle — ask about timing or budget, not the specific vehicle.",
    "follow_up_day14": "Two weeks with no reply. This is a last real attempt. Keep it human and low-pressure.",
    "follow_up_day30": "Final follow-up. Acknowledge that some time has passed. Leave the door open for the future.",
    "inbound_reply": "The lead just replied. Respond naturally and directly to what they said. Classify intent based on their message.",
}

ALL_TRIGGERS = list(TRIGGER_INSTRUCTIONS.keys())

# ── Test runner ────────────────────────────────────────────────────────────────

def run_test(trigger: str, vehicle: str, last_reply: str = "", verbose: bool = False) -> dict:
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    conversation_snippet = ""
    if last_reply:
        conversation_snippet = f"CUSTOMER: {last_reply}"

    user_message = f"""LEAD CONTEXT:
Name: James Tremblay
Source: website
Vehicle interest: {vehicle or "(not specified)"}
Trigger: {trigger}
Last 3 messages: {conversation_snippet or "(none — no conversation yet)"}
Last lead reply: {last_reply or "(none)"}

TRIGGER INSTRUCTIONS: {TRIGGER_INSTRUCTIONS[trigger]}"""

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    raw = message.content[0].text.strip()

    if verbose:
        print(f"\n--- Raw response ---\n{raw}\n---")

    result = json.loads(raw)
    return result


def print_result(trigger: str, result: dict):
    intent = result.get("intent_score", "?").upper()
    sms = result.get("sms_text", "")
    reasoning = result.get("intent_reasoning", "")
    char_count = len(sms)
    over = " (OVER 160!)" if char_count > 160 else ""

    print(f"\n[{trigger}]")
    print(f"  SMS ({char_count} chars{over}):")
    print(f"  \"{sms}\"")
    print(f"  Intent: {intent} — {reasoning}")


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Test dealership Claude SMS prompt locally")
    parser.add_argument("--trigger", choices=ALL_TRIGGERS, default="first_contact")
    parser.add_argument("--vehicle", default="2024 Toyota Camry LE", help="Vehicle interest string")
    parser.add_argument("--reply", default="", help="Simulated lead reply (for inbound_reply trigger)")
    parser.add_argument("--all", action="store_true", dest="test_all", help="Test all 5 outbound triggers")
    parser.add_argument("--verbose", action="store_true", help="Print raw Claude response")
    args = parser.parse_args()

    if not os.getenv("ANTHROPIC_API_KEY"):
        print("ERROR: ANTHROPIC_API_KEY not set in .env")
        return

    if args.test_all:
        print(f"Testing all triggers for vehicle: {args.vehicle}")
        outbound_triggers = [t for t in ALL_TRIGGERS if t != "inbound_reply"]
        for trigger in outbound_triggers:
            result = run_test(trigger, args.vehicle, verbose=args.verbose)
            print_result(trigger, result)
    else:
        if args.trigger == "inbound_reply" and not args.reply:
            args.reply = "What's the price on that Camry?"
            print(f"No --reply provided. Using default: \"{args.reply}\"")
        result = run_test(args.trigger, args.vehicle, last_reply=args.reply, verbose=args.verbose)
        print_result(args.trigger, result)


if __name__ == "__main__":
    main()

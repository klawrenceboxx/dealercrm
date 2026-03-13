# Workflow: Eli Doueri — SMS Lead Funnel

## Objective
Automatically follow up with car dealership leads via AI-generated SMS. Classify intent, run a 30-day sequence, alert sales on hot leads.

## Required Inputs
- Lead data: first_name, last_name, phone, email, source, vehicle_interest
- n8n instance running with all 5 workflows active
- Airtable base set up with Leads, Messages, Inventory tables
- Twilio phone number configured
- ANTHROPIC_API_KEY in n8n environment variables

## Workflow Map

```
[01] Lead Intake
  Trigger: Webhook (website form / Meta Lead Ads)
  → Normalize fields (E.164 phone, UUID lead_id)
  → Check for duplicate phone in Airtable
  → Create record in Airtable Leads table
  → POST to Workflow 02 with {airtable_record_id, trigger_type: "first_contact"}

[02] AI SMS Engine
  Trigger: Webhook (called by 01 and 04)
  Input: {airtable_record_id, trigger_type}
  → Get lead from Airtable
  → Get available inventory from Airtable Inventory table
  → Build Claude prompt (system + user message)
  → Call Claude API (Haiku): POST https://api.anthropic.com/v1/messages
  → Parse JSON response: sms_text, intent_score, intent_reasoning
  → If demo_mode = true: skip Twilio, prepend "[DEMO]"
  → If demo_mode = false: Twilio → Send SMS
  → Create record in Airtable Messages table
  → Update lead record: last_sms_at, sms_count, intent_score, stage, sequence_step, next_follow_up
  → If intent_score = hot: POST to Workflow 05

[03] Inbound SMS Handler
  Trigger: Twilio webhook ("A message comes in")
  → Find lead by phone in Airtable
  → Check for opt-out keywords: STOP, UNSUBSCRIBE, QUIT, CANCEL
    → If opt-out: update Airtable opted_out=true, stage=Unsubscribed, send confirmation, stop
  → Log inbound message in Airtable Messages table
  → Update lead: last_reply_at = now
  → Call Claude API with trigger_type = "inbound_reply", last 3 messages, new reply
  → Branch on intent_score:
    hot  → update stage=Hot, POST to Workflow 05, send Claude reply
    warm → update stage=Warm, clear next_follow_up, send Claude reply
    cold → update stage=Warm, set next_follow_up = now+3days, send Claude reply
  → Twilio → Send SMS (Claude reply)
  → Log outbound in Airtable Messages table

[04] Sequence Scheduler
  Trigger: Schedule — every 15 minutes
  → Airtable search: next_follow_up <= now AND opted_out=false AND stage not in [Hot, Closed, Unsubscribed]
  → For each result: map sequence_step → trigger_type, POST to Workflow 02
  → If sequence_step > 4: update stage=Closed

[05] Hot Lead Alert
  Trigger: Webhook (called by 02 and 03)
  → Get lead from Airtable
  → Check salesperson_alerted — if true, stop (deduplication)
  → Build alert: name, phone, vehicle, last reply
  → Twilio → Send SMS to salesperson number
  → Gmail → Send email with full conversation log
  → Update Airtable: salesperson_alerted=true, stage=Hot
```

## Claude API Call (Workflow 02)

```
POST https://api.anthropic.com/v1/messages
Headers:
  x-api-key: {{$env.ANTHROPIC_API_KEY}}
  anthropic-version: 2023-06-01
  content-type: application/json

Body:
{
  "model": "claude-haiku-4-5-20251001",
  "max_tokens": 256,
  "system": "[system prompt — see tools/test_claude_prompt.py for full text]",
  "messages": [{"role": "user", "content": "[user message with lead context]"}]
}

Parse response: body.content[0].text → JSON.parse → sms_text, intent_score
```

## Sequence Step → trigger_type Map

| sequence_step | trigger_type | next_follow_up after send |
|---|---|---|
| 0 | first_contact | now + 3 days |
| 1 | follow_up_day3 | now + 4 days |
| 2 | follow_up_day7 | now + 7 days |
| 3 | follow_up_day14 | now + 16 days |
| 4 | follow_up_day30 | null (sequence ends) |

Increment sequence_step by 1 after each send.

## n8n Environment Variables (set in n8n → Settings → Variables)

| Variable | Value |
|----------|-------|
| ANTHROPIC_API_KEY | from .env |
| AIRTABLE_API_KEY | from .env |
| AIRTABLE_BASE_ID | from .env |
| AIRTABLE_LEADS_TABLE_ID | from .env |
| AIRTABLE_MESSAGES_TABLE_ID | from .env |
| AIRTABLE_INVENTORY_TABLE_ID | from .env |
| TWILIO_ACCOUNT_SID | from .env |
| TWILIO_AUTH_TOKEN | from .env |
| TWILIO_FROM_NUMBER | from .env |
| SALESPERSON_PHONE | Sleiman provides |
| SALESPERSON_EMAIL | Sleiman provides |
| SALESPERSON_NAME | Sleiman provides |
| DEALERSHIP_NAME | Sleiman provides |
| DEALERSHIP_HOURS | Sleiman provides |
| DEALERSHIP_CITY | Sleiman provides |

## Demo Mode

- In Airtable Leads table, set `Demo Mode = checked` on test leads
- Workflow 02 checks this flag: if true, SMS is NOT sent via Twilio
- Instead, message is prepended with `[DEMO]` and logged to Messages table
- This lets you verify the full flow (intake → Claude → sequence → inbound) without sending real texts

## Edge Cases

**Duplicate phone number on intake:**
Workflow 01 searches Airtable for existing lead with same phone before creating.
If found: update `Last Seen` field, skip creating new record.

**Lead has no phone number:**
Workflow 01 checks for empty phone. If missing: write error to Notes field, skip SMS trigger.

**Claude returns invalid JSON:**
Add error handling in n8n Code node: try JSON.parse(), catch → use fallback message + intent_score = "cold".

**Opt-out compliance (TCPA):**
Workflow 03 checks first for STOP/UNSUBSCRIBE/QUIT/CANCEL before anything else.
Response confirmation: "You've been unsubscribed from [DEALERSHIP]. Text START to re-subscribe."
`opted_out = true` prevents all future outbound SMS — Workflow 04 filters this out.

**Rate limits:**
- Claude Haiku: no practical limit at this volume
- Twilio: no rate limit concern at 200 leads/month
- Airtable API: 5 requests/second per base — not a concern at this scale

## Testing

```bash
# 1. Test Claude prompt locally
python tools/test_claude_prompt.py --all

# 2. Fire a demo lead at n8n
python tools/simulate_lead.py

# 3. Verify in Airtable: lead created, [DEMO] message in Messages table

# 4. To test scheduler: set next_follow_up on a test lead to a past time in Airtable
#    Workflow 04 picks it up within 15 minutes

# 5. To test inbound: POST manually to Workflow 03 webhook URL
#    curl -X POST https://[n8n-url]/webhook/[03-id] \
#      -H "Content-Type: application/json" \
#      -d '{"From": "+15145550101", "Body": "What is the price on the Camry?"}'
```

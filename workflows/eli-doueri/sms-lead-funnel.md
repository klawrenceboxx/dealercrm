# Workflow: Eli Doueri — SMS Lead Funnel

## Objective
Automatically follow up with car dealership leads via AI-generated SMS. Classify intent, run a 30-day sequence, alert sales on hot leads.

## Required Inputs
- Lead data: first_name, last_name, phone, email, source, vehicle_interest
- n8n instance running with all 5 workflows active
- Supabase project with schema applied (leads, sms_log, inventory, profiles, settings tables)
- Twilio phone number configured
- ANTHROPIC_API_KEY in n8n environment variables

## Workflow Map

```
[01] Lead Intake
  Trigger: Webhook (website form / Meta Lead Ads)
  → Normalize fields (E.164 phone, UUID lead_id)
  → Check for duplicate phone in Supabase
  → INSERT into Supabase leads table
  → POST to Workflow 02 with {lead_id, trigger_type: "first_contact"}

[02] AI SMS Engine
  Trigger: Webhook (called by 01 and 04)
  Input: {lead_id, trigger_type}
  → Get lead from Supabase
  → Get available inventory from Supabase inventory table
  → Build Claude prompt (system + user message)
  → Call Claude API (Haiku): POST https://api.anthropic.com/v1/messages
  → Parse JSON response: sms_text, intent_score, intent_reasoning
  → If demo_mode = true: skip Twilio, prepend "[DEMO]"
  → If demo_mode = false: Twilio → Send SMS
  → INSERT into Supabase sms_log table
  → UPDATE lead: last_sms_at, sms_count, intent_score, stage, sequence_step, next_follow_up
  → If intent_score = hot: POST to Workflow 05

[03] Inbound SMS Handler
  Trigger: Twilio webhook ("A message comes in")
  → Find lead by phone in Supabase
  → *** AUTOPILOT GUARDRAIL: IF autopilot_active === false → STOP (do not query Claude, do not auto-reply) ***
  → Check for opt-out keywords: STOP, UNSUBSCRIBE, QUIT, CANCEL
    → If opt-out: update Supabase opted_out=true, stage=Unsubscribed, send confirmation, stop
  → Log inbound message in Supabase sms_log table
  → Update lead: last_reply_at = now
  → Call Claude API with trigger_type = "inbound_reply", last 3 messages, new reply
  → Branch on intent_score:
    hot  → update stage=Hot, POST to Workflow 05, send Claude reply
    warm → update stage=Warm, clear next_follow_up, send Claude reply
    cold → update stage=Warm, set next_follow_up = now+3days, send Claude reply
  → Twilio → Send SMS (Claude reply)
  → Log outbound in Supabase sms_log table

[04] Sequence Scheduler
  Trigger: Schedule — every 15 minutes
  → Supabase query: next_follow_up <= now AND opted_out=false AND autopilot_active=true AND stage not in [Hot, Closed, Unsubscribed]
  → For each result: map sequence_step → trigger_type, POST to Workflow 02
  → If sequence_step > 4: update stage=Closed

[05] Hot Lead Alert
  Trigger: Webhook (called by 02 and 03)
  → Get lead from Supabase
  → Check salesperson_alerted — if true, stop (deduplication)
  → Build alert: name, phone, vehicle, last reply
  → Twilio → Send SMS to salesperson number
  → Gmail → Send email to SALESPERSON_EMAIL with full sms_log conversation history
  → Update Supabase: salesperson_alerted=true, stage=Hot
```

## Supabase Connection (all workflows)

n8n connects to Supabase via HTTP Request nodes using the service role key:
- URL: `https://{{$env.SUPABASE_URL}}/rest/v1/[table]`
- Headers:
  - `apikey: {{$env.SUPABASE_SERVICE_ROLE_KEY}}`
  - `Authorization: Bearer {{$env.SUPABASE_SERVICE_ROLE_KEY}}`
  - `Content-Type: application/json`
  - `Prefer: return=representation` (for INSERT/UPDATE to return the record)
- This bypasses RLS (service role has full access)

### Common Supabase Queries

**SELECT lead by ID:**
```
GET /rest/v1/leads?id=eq.{{lead_id}}&select=*
```

**SELECT lead by phone (inbound lookup):**
```
GET /rest/v1/leads?phone=eq.{{phone}}&select=*&limit=1
```

**INSERT sms_log:**
```
POST /rest/v1/sms_log
Body: { "lead_id": "...", "direction": "outbound", "body": "...", "trigger_type": "...", "demo": false }
```

**UPDATE lead after SMS:**
```
PATCH /rest/v1/leads?id=eq.{{lead_id}}
Body: { "last_sms_at": "now()", "sms_count": {{sms_count + 1}}, "intent_score": "...", "sequence_step": {{step + 1}}, "next_follow_up": "..." }
```

**Scheduler query (Workflow 04):**
```
GET /rest/v1/leads?next_follow_up=lte.{{now}}&opted_out=eq.false&autopilot_active=eq.true&stage=not.in.(hot,closed,unsubscribed)&select=id,lead_id,sequence_step,phone,first_name
```

**SELECT available inventory (for Claude context):**
```
GET /rest/v1/inventory?status=eq.available&select=vehicle,year,make,model,trim,color,mileage,price
```

**SELECT sms_log for hot lead alert email:**
```
GET /rest/v1/sms_log?lead_id=eq.{{lead_id}}&select=direction,body,sent_at&order=sent_at.asc
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
| SUPABASE_URL | Supabase project URL (e.g., https://ntohjufkraavvvarqiyq.supabase.co) |
| SUPABASE_SERVICE_ROLE_KEY | from Supabase dashboard → Settings → API |
| TWILIO_ACCOUNT_SID | from .env |
| TWILIO_AUTH_TOKEN | from .env |
| TWILIO_FROM_NUMBER | from .env |
| SALESPERSON_PHONE | Sleiman provides |
| SALESPERSON_EMAIL | Sleiman provides |
| SALESPERSON_NAME | Sleiman provides |
| DEALERSHIP_NAME | Sleiman provides |
| DEALERSHIP_HOURS | Sleiman provides |
| DEALERSHIP_CITY | Sleiman provides |

## Autopilot Guardrail

The `autopilot_active` boolean on the leads table controls whether the AI can auto-reply and auto-schedule follow-ups:

- **Workflow 03 (Inbound Handler):** After looking up the lead by phone, check `autopilot_active`. If `false`, log the inbound message to `sms_log` but do NOT query Claude, do NOT send an auto-reply, and do NOT update the lead's stage/intent. The rep is handling this lead manually.
- **Workflow 04 (Scheduler):** The scheduler query already filters by `autopilot_active=eq.true`, so paused leads are never picked up.
- **Frontend auto-kill:** When a rep starts typing in the manual SMS input on LeadDetail, the frontend sets `autopilot_active = false` automatically.
- **Re-enabling:** The rep can re-enable autopilot via the toggle switch in the SMS tab on LeadDetail.

## Demo Mode

- In Supabase leads table, `demo_mode = true` (default during development)
- Workflow 02 checks this flag: if true, SMS is NOT sent via Twilio
- Instead, message is prepended with `[DEMO]` and logged to sms_log table
- This lets you verify the full flow (intake → Claude → sequence → inbound) without sending real texts

## Hot Lead Alert Email (Workflow 05)

The Gmail API node sends an email to `{{$env.SALESPERSON_EMAIL}}` containing:
- Subject: `Hot Lead: {{first_name}} {{last_name}} — {{vehicle_interest}}`
- Body: formatted HTML with lead details (name, phone, source, vehicle interest, intent score) and the full SMS conversation history from `sms_log` ordered by `sent_at`.
- Each message in the history should show direction (Inbound/Outbound), timestamp, and body text.

## Edge Cases

**Duplicate phone number on intake:**
Workflow 01 queries Supabase for existing lead with same phone before creating.
If found: update `created_at` field to now, skip creating new record.

**Lead has no phone number:**
Workflow 01 checks for empty phone. If missing: insert a note to the notes table with error, skip SMS trigger.

**Claude returns invalid JSON:**
Add error handling in n8n Code node: try JSON.parse(), catch → use fallback message + intent_score = "cold".

**Opt-out compliance (TCPA):**
Workflow 03 checks first for STOP/UNSUBSCRIBE/QUIT/CANCEL before anything else (even before autopilot check).
Response confirmation: "You've been unsubscribed from [DEALERSHIP]. Text START to re-subscribe."
`opted_out = true` prevents all future outbound SMS — Workflow 04 filters this out.

**Rate limits:**
- Claude Haiku: no practical limit at this volume
- Twilio: no rate limit concern at 200 leads/month
- Supabase REST API: no practical limit at this scale

## Testing

```bash
# 1. Test Claude prompt locally
python tools/test_claude_prompt.py --all

# 2. Fire a demo lead at n8n
python tools/simulate_lead.py

# 3. Verify in Supabase: lead created, [DEMO] message in sms_log table

# 4. To test scheduler: set next_follow_up on a test lead to a past time in Supabase
#    Workflow 04 picks it up within 15 minutes

# 5. To test inbound: POST manually to Workflow 03 webhook URL
#    curl -X POST https://[n8n-url]/webhook/[03-id] \
#      -H "Content-Type: application/json" \
#      -d '{"From": "+15145550101", "Body": "What is the price on the Camry?"}'
```

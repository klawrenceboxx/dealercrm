# Workflow: Eli Doueri — Go-Live Migration

## Objective
Migrate from demo mode to live production. All steps are config swaps — no code changes needed.

## What Sleiman Must Provide

| Item | Where to find it | Used for |
|------|---|---|
| AutoRaptor export (lead history) | AutoRaptor → Export | Optional — import historical leads into Airtable |
| Website form config access | Dev/webmaster | Point form POST to Workflow 01 webhook URL |
| Meta Business Manager access | business.facebook.com | Connect Meta Lead Ads to Workflow 01 |
| Twilio account (or approval for Kaleel to create) | twilio.com | SMS sending/receiving |
| Salesperson name, phone, email | Sleiman provides | Workflow 05 hot lead alerts |
| Dealership name | | Claude system prompt |
| Dealership hours | | Claude system prompt |
| Dealership city/location | | Claude system prompt |
| Initial inventory | CSV or Airtable entry | Claude inventory context |

## Go-Live Steps

### Step 1 — Update n8n environment variables

In n8n → Settings → Variables, update:

| Variable | Change to |
|----------|-----------|
| SALESPERSON_NAME | (from Sleiman) |
| SALESPERSON_PHONE | (from Sleiman) |
| SALESPERSON_EMAIL | (from Sleiman) |
| DEALERSHIP_NAME | (from Sleiman) |
| DEALERSHIP_HOURS | (from Sleiman) |
| DEALERSHIP_CITY | (from Sleiman) |

Update the Claude system prompt in Workflow 02 with real dealership details.

### Step 2 — Twilio production setup

1. Sign up at twilio.com (or get account credentials from Sleiman)
2. Purchase a local phone number (Canada — should have local area code)
3. In Twilio console → Phone Numbers → configure the number:
   - "A message comes in" → Webhook → Workflow 03 URL (from n8n)
   - HTTP POST
4. Add to n8n environment variables: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER

### Step 3 — Connect website form

Kaleel provides: Workflow 01 webhook URL (from n8n)
Sleiman/dev adds to form config as the form action/POST endpoint.

Expected POST body (minimum):
```json
{
  "first_name": "...",
  "last_name": "...",
  "phone": "...",
  "email": "...",
  "vehicle_interest": "...",
  "source": "website"
}
```

### Step 4 — Connect Meta Lead Ads

Option A (recommended): Use n8n's built-in Facebook Lead Ads trigger in Workflow 01.
- Connect n8n to Meta Business Manager via OAuth
- Select the lead ad form
- Map fields: first_name, last_name, phone_number, email → normalize in Workflow 01 Code node

Option B: Use Make.com or Zapier as a bridge (Facebook → webhook) if direct n8n Meta connection is not available.

### Step 5 — Disable demo mode

In Airtable Leads table: make sure `Demo Mode` is unchecked on all future records.
In Workflow 01: set default value of `demo_mode` field to `false` in the Create Record node.

### Step 6 — Add initial inventory

Import Sleiman's inventory list to Airtable Inventory table.
- Option A: CSV import via Airtable UI
- Option B: Sleiman enters rows manually in Airtable

Set all Status values to "Available", "Pending", or "Sold" as appropriate.

### Step 7 — Test with one real lead

Fire one test lead through the real form (or use `python tools/simulate_lead.py --live`).
Confirm:
- Lead appears in Airtable Leads table (Demo Mode unchecked)
- SMS is sent via Twilio to the test phone
- Message logged in Airtable Messages table (no [DEMO] prefix)
- Check the SMS content — verify inventory is referenced correctly

### Step 8 — Test hot lead alert

Manually trigger Workflow 05 via n8n (or simulate a "hot" reply via Workflow 03 webhook).
Confirm:
- Salesperson receives SMS alert
- Salesperson receives email with conversation log
- Lead stage updated to Hot in Airtable

### Step 9 — Test ADF / AutoRaptor (if keeping AutoRaptor alongside temporarily)

If Sleiman wants to keep AutoRaptor running in parallel during transition:
- Not required — this system fully replaces it
- If needed, document manually: export Airtable records weekly, import to AutoRaptor manually

### Step 10 — Hand off to Sleiman

Deliver:
- Loom walkthrough (~10 min):
  1. Show a lead coming in
  2. Show the AI-generated SMS in Messages table
  3. Show the 30-day sequence in action
  4. Simulate a hot reply → show salesperson alert
  5. Show Airtable Kanban with stages
  6. Walk through how to update inventory
- Written migration docs (this file)
- Airtable login credentials or invite Sleiman as a member

## Post-Go-Live Monitoring (first week)

- Check Airtable daily: any leads stuck in "New" (sequence not firing)?
- Check Twilio: any delivery failures?
- Check n8n execution log: any workflow errors?
- Verify Claude responses are on-brand and inventory-accurate
- Confirm Sleiman can log into Airtable and understands the Kanban

## Rollback Plan

If something breaks after go-live:
1. Set `demo_mode = true` on new leads in Airtable (pauses SMS sends)
2. Diagnose issue in n8n execution log
3. Fix, test in demo mode, re-enable
4. No data is lost — Airtable records persist

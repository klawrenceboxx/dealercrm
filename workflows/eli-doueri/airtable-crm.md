# Workflow: Eli Doueri — Airtable CRM Setup

## Objective
Set up and maintain the Airtable "Lead CRM" base that replaces AutoRaptor.

## Initial Setup

**Step 1: Get Airtable Personal Access Token**
1. Log in to airtable.com
2. Go to Account → Developer Hub → Personal Access Tokens
3. Create token with scopes: `data:records:write`, `schema:bases:write`, `schema:bases:read`
4. Add to `.env`: `AIRTABLE_API_KEY=...`

**Step 2: Create the base**
```bash
# List available workspaces
python tools/airtable_setup.py --list-workspaces

# Create the base (auto-detects workspace if you only have one)
python tools/airtable_setup.py --create

# Or specify workspace explicitly
python tools/airtable_setup.py --create --workspace wsXXXXXXXX
```
This creates the base + all tables + fields and writes IDs to .env.

**Step 3: Verify in Airtable**
- Open airtable.com → look for "Lead CRM" base
- Confirm 3 tables: Leads, Messages, Inventory
- Check field names match the schema

**Step 4: Set up views (manual — do in Airtable UI)**

Leads table:
- Grid view (default) — all leads
- Kanban view — group by Stage (New → Contacted → Warm → Hot → Closed)
- Grid view "Hot Leads" — filter: Stage = Hot, sort by Last Reply At descending

Messages table:
- Grid view (default) — all messages
- Grid view "By Lead" — group by Lead Phone, sort by Timestamp

Inventory table:
- Grid view (default) — all inventory
- Grid view "Available" — filter: Status = Available

## How the Sales Team Uses Airtable

**Daily routine:**
1. Open Airtable → Lead CRM → Leads table → Kanban view
2. Check "Hot" column — these are hot leads that need a call now
3. Click any lead to see full conversation history in the Messages table (linked records)
4. Manually move leads to "Closed" or add Notes as needed

**When a lead goes hot:**
- Salesperson gets an SMS + email alert automatically (Workflow 05)
- Lead appears in Hot column in Kanban
- Messages table shows full conversation including AI's replies

**Managing inventory:**
- Sleiman updates the Inventory table directly in Airtable whenever a car is sold or added
- Change Status field: Available / Pending / Sold
- n8n pulls available inventory before every AI SMS call

## Tables Reference

### Leads

Primary field: **Name** — set by n8n as "{First Name} {Last Name}"

Key fields for sales team:
- **Stage** — pipeline position (New → Contacted → Warm → Hot → Closed)
- **Intent Score** — latest Claude classification (Cold / Warm / Hot)
- **Vehicle Interest** — what they asked about
- **Phone** — to call them directly
- **Notes** — manual notes from the sales team
- **Next Follow-Up** — when the next automated SMS fires (set by n8n)

Fields set automatically by n8n (don't edit):
- lead_id, Sequence Step, Last SMS At, Last Reply At, SMS Count, Opted Out, Salesperson Alerted, Demo Mode

### Messages

One row per SMS message (inbound or outbound). Linked to Leads via Lead Phone field.

- **Role** = Outbound (we sent it) or Inbound (lead replied)
- **Content** = full SMS text
- **Demo** = checked if it was suppressed in demo mode

### Inventory

Sleiman maintains this. n8n reads it to inform AI responses.

Format for Vehicle field: `{Year} {Make} {Model} {Trim}` (e.g., "2024 Toyota Camry LE")

## Notes

- All timestamps are Eastern Time (America/New_York) as configured in airtable_setup.py
- Do not delete or rename fields — n8n references them by name via the Airtable API
- Airtable free tier: 1,000 records per base, 100 automation runs/month
  - For a dealership with 200 leads/month, upgrade to Airtable Team ($20/month/user)
  - Records accumulate — archive old closed/unsubscribed leads periodically

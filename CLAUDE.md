# DealerCRM — Project Context

A custom CRM web app replacing AutoRaptor for Eli Doueri's car dealership. Built for Sleiman (Eli's nephew) as the day-to-day user.

## What This Is

A private internal tool — not public-facing, not multi-tenant. One user (Sleiman) logs in to manage dealership leads. The AI-powered SMS automation runs in the background via n8n and Twilio.

## Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Database + Auth | Supabase (Postgres) | Lead records, SMS log, notes, inventory, auth |
| Frontend | Vite + React + TailwindCSS | CRM UI (leads, pipeline, dashboard) |
| Automation | n8n | Webhooks, SMS sequencing, Claude API calls |
| SMS | Twilio | Sending and receiving SMS |
| AI | Claude API (Haiku) | SMS response generation + intent classification |
| Hosting | Vercel (via GitHub) | Free frontend hosting |

## Directory Layout

```
dealercrm/
  src/
    App.jsx               — sidebar layout + router
    index.css             — Tailwind v4 import + global reset
    lib/
      supabase.js         — Supabase client (reads VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY)
    pages/
      Leads.jsx           — lead list with search + stage filter
      LeadDetail.jsx      — lead info, SMS thread, notes
      Pipeline.jsx        — kanban board by stage
      Dashboard.jsx       — stats, conversion, source breakdown, daily chart
  supabase/
    schema.sql            — run in Supabase SQL Editor to set up DB
  tools/
    simulate_lead.py      — fire fake leads at n8n intake webhook (testing)
    test_claude_prompt.py — test Claude SMS prompt locally
  workflows/
    eli-doueri/
      sms-lead-funnel.md  — n8n workflow map, Claude API config, edge cases
      airtable-crm.md     — (legacy — Airtable replaced by Supabase)
      go-live-migration.md — go-live checklist for Sleiman
  .env.example            — copy to .env and fill in values
  CLAUDE.md               — this file
```

## Supabase Tables

| Table | Purpose |
|-------|---------|
| `leads` | Main CRM — one row per lead. n8n creates, UI reads/updates. |
| `sms_log` | Full SMS conversation history per lead |
| `notes` | Manual notes added via the UI |
| `inventory` | Current lot — Sleiman maintains. n8n reads for Claude context. |

- **Frontend** uses anon key + Supabase Auth (RLS enforced)
- **n8n** uses service role key (bypasses RLS)

## Auth

Single user. Supabase Auth (email + password). Sleiman creates his own account via Supabase dashboard or invite link. No public signup.

## n8n Workflows (5 total)

All documented in `workflows/eli-doueri/sms-lead-funnel.md`. Summary:

1. **Lead Intake** — webhook from website/Meta → create lead in Supabase → trigger SMS
2. **AI SMS Engine** — pull inventory, call Claude Haiku, send SMS via Twilio, log to Supabase
3. **Inbound SMS Handler** — Twilio webhook → classify reply → AI response → update Supabase
4. **Sequence Scheduler** — cron every 15min → find due leads in Supabase → trigger SMS
5. **Hot Lead Alert** — SMS + email to salesperson when Claude classifies intent = hot

## n8n → Supabase Integration

n8n uses the **Supabase node** (built-in) or HTTP Request to the Supabase REST API.
- URL: `https://[project-ref].supabase.co/rest/v1/[table]`
- Header: `apikey: [SUPABASE_SERVICE_ROLE_KEY]`
- Header: `Authorization: Bearer [SUPABASE_SERVICE_ROLE_KEY]`

## Environment Variables

Copy `.env.example` to `.env` and fill in:
- `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` — from Supabase → Settings → API
- `SUPABASE_SERVICE_ROLE_KEY` — same location, used by n8n (NOT the VITE_ prefixed one)
- `N8N_WEBHOOK_INTAKE` — from n8n after creating Workflow 01
- `TWILIO_*` — from Twilio console
- `ANTHROPIC_API_KEY` — already in agent_1 .env, copy over

## Setup Order

1. Run `supabase/schema.sql` in Supabase SQL Editor
2. Add env vars to `.env`
3. `npm install && npm run dev` — verify app loads
4. Set up n8n workflows (see `workflows/eli-doueri/sms-lead-funnel.md`)
5. Test: `python tools/simulate_lead.py` — verify lead appears in Supabase + UI
6. Test: `python tools/test_claude_prompt.py --all` — verify Claude SMS quality
7. Deploy to Vercel via GitHub

## What Sleiman Sees

- **Leads** — searchable table of all leads, click to open detail
- **Lead detail** — full SMS thread, notes, stage selector
- **Pipeline** — kanban by stage, drag between columns or use dropdown
- **Dashboard** — total leads, hot leads, closed, conversion %, source breakdown, 14-day chart

## Build Status

| Phase | Status |
|-------|--------|
| Project scaffold (Vite + React + Tailwind + Supabase) | Done |
| Supabase schema | Done |
| All 4 pages scaffolded | Done |
| Tools migrated (simulate_lead, test_claude_prompt) | Done |
| Workflow SOPs migrated | Done |
| n8n workflows built | Pending |
| Supabase project created + schema applied | Pending |
| Auth configured | Pending |
| Vercel deploy | Pending |

# DealerCRM — Project Assistant

You are Kaleel's dev assistant for the `dealercrm` project. Stay focused on this build. Do not reference Upwork, 123loadboard, Vipul, or anything unrelated to this project.

## Who You're Working With
@context/kaleel.md
@context/client.md

## Communication Rules
Rules live in `.claude/rules/`. Default: bullet points, short, casual internally.

---

## What This Is

A custom CRM web app replacing AutoRaptor for Eli Doueri's car dealership. Built for **Sleiman Moujaes** (Eli's nephew) as the day-to-day user.

**Why:** AutoRaptor has no API, costs ~$100/month, and the team hates it. This replacement is faster, cheaper, and purpose-built for their workflow. It's also a productizable template for other car dealerships.

**Build strategy:** Demo-first. Build working system with fake leads. Show Sleiman. Get sign-off. Swap in real credentials. Invoice. Go live.

**Budget:** $2,000 client / ~$1,800 after fees
**Client running cost:** ~$28-35/month (Supabase ~$0-25 + Twilio ~$8 + n8n ~$0 self-hosted or $20 cloud + Claude API ~$0.02)

---

## Stack

| Layer | Tool | Notes |
|-------|------|-------|
| Database + Auth | Supabase (Postgres) | leads, sms_log, notes, inventory tables |
| Frontend | Vite + React + Tailwind v4 | Scaffolded. 4 pages built. |
| Automation | n8n | 5 workflows — not built yet |
| SMS | Twilio | Sandbox for demo, production for live |
| AI | Claude API (Haiku) | SMS generation + intent classification |
| Hosting | Vercel via GitHub | Free tier |

---

## What's Already Built

### Frontend (`src/`)
- `App.jsx` — sidebar nav + BrowserRouter (Leads / Pipeline / Dashboard)
- `lib/supabase.js` — Supabase client, reads `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- `pages/Leads.jsx` — table view, search + stage filter, click-to-open
- `pages/LeadDetail.jsx` — lead info, SMS thread (chat bubbles), notes (add/view), stage dropdown
- `pages/Pipeline.jsx` — kanban board by stage, inline stage move
- `pages/Dashboard.jsx` — 4 stat cards, stage/source/intent breakdowns, 14-day lead chart

### Database
- `supabase/schema.sql` — complete schema: leads, sms_log, notes, inventory; RLS policies; indexes; sample inventory data. **Not yet applied to a live Supabase project.**

### Tools (in `tools/`)
- `simulate_lead.py` — fires fake leads at n8n intake webhook. Flags: `--all`, `--live`, `--source`, `--phone`, `--vehicle`. Reads `N8N_WEBHOOK_INTAKE` from `.env`.
- `test_claude_prompt.py` — tests Claude SMS prompt locally across all 5 trigger types. Reads `ANTHROPIC_API_KEY` from `.env`.

### Docs (in `workflows/eli-doueri/`)
- `sms-lead-funnel.md` — full n8n workflow map, Claude API call details, sequence logic, edge cases
- `go-live-migration.md` — 10-step go-live checklist for Sleiman
- `airtable-crm.md` — legacy (Airtable was replaced by Supabase, ignore this)

---

## What's NOT Built Yet

In priority order:

1. **Supabase project** — needs to be created at supabase.com, schema.sql applied, credentials in .env
2. **n8n workflows (5 total)** — the automation layer. See `workflows/eli-doueri/sms-lead-funnel.md` for exact spec.
3. **Supabase Auth** — single user login for Sleiman. Supabase built-in auth (email + password).
4. **Auth gate in the frontend** — redirect to login if no session. Simple — Supabase Auth UI or custom form.
5. **GitHub repo + Vercel deploy** — push to GitHub, connect Vercel. Should be ~10 minutes.
6. **n8n → Supabase rewire** — n8n uses service role key to insert leads, log SMS, update records.

---

## n8n Workflow Architecture (to build)

```
[01] Lead Intake       Webhook → normalize → Supabase insert → trigger [02]
[02] AI SMS Engine     Get lead + inventory → Claude Haiku → Twilio SMS → Supabase log
[03] Inbound Handler   Twilio webhook → Claude classify → AI reply → Supabase update
[04] Sequence Sched.   Cron 15min → query Supabase for due leads → trigger [02]
[05] Hot Lead Alert    Webhook → SMS + email to salesperson → Supabase stage=hot
```

Full node-by-node spec in `workflows/eli-doueri/sms-lead-funnel.md`.

**n8n → Supabase:** Use HTTP Request node with service role key, or the native Supabase n8n node.
- URL: `https://[ref].supabase.co/rest/v1/[table]`
- Headers: `apikey: [SERVICE_ROLE_KEY]`, `Authorization: Bearer [SERVICE_ROLE_KEY]`

---

## Supabase Tables

| Table | Who writes | Who reads |
|-------|-----------|-----------|
| `leads` | n8n (intake) | React frontend + n8n (scheduler) |
| `sms_log` | n8n (after each SMS) | React frontend (LeadDetail SMS thread) |
| `notes` | React frontend (manual) | React frontend |
| `inventory` | Sleiman (manual in Supabase UI or frontend) | n8n (Claude context) |

---

## Environment Variables

See `.env.example`. Key ones:
- `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` — frontend (public)
- `SUPABASE_SERVICE_ROLE_KEY` — n8n only, never in frontend
- `N8N_WEBHOOK_INTAKE` — set after building Workflow 01 in n8n
- `ANTHROPIC_API_KEY` — copy from agent_1 `.env`
- `TWILIO_*` — from Twilio console

---

## Key Contacts

- **Eli Doueri** — owner, mr.doueri@gmail.com
- **Sleiman Moujaes** — nephew, day-to-day contact for the dealership build

---

## How to Run Locally

```bash
npm install
# copy .env.example to .env and fill in VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev
# → http://localhost:5173
```

---

## WAT Framework Note

This project uses the same WAT approach as `agent_1`:
- **Workflows** → `workflows/eli-doueri/` (SOPs for n8n setup, migration)
- **Agent** → you (read the workflow, make decisions, call tools)
- **Tools** → `tools/simulate_lead.py`, `tools/test_claude_prompt.py`

When you need to test something or fire a fake lead, use the tools in `tools/`. Don't do it manually.

# DealerCRM — Project Instructions

You are Kaleel's dev assistant for the `dealercrm` project. Stay focused on this build.

## Context Loading Rules

**DO NOT auto-load context files at conversation start.** Only read files when the current task requires them.

- **Never** spawn explorers or agents to "understand the codebase" before being asked to do something specific
- **Never** read more than 3 files before starting work on a task
- **If you need schema info:** read `supabase/schema.sql` (not SYSTEM_CONTEXT.md)
- **If you need workflow spec:** read `workflows/eli-doueri/sms-lead-funnel.md`
- **If you need frontend patterns:** read the specific page file in `src/pages/`
- **If you need client history:** check persistent memory first, then `context/` files only if memory is insufficient
- **Planning tasks:** use the `plan` skill — do NOT spawn multiple explorer agents

## Project Summary

Custom CRM replacing AutoRaptor for Eli Doueri's car dealership (Style Auto, Quebec). Built for Sleiman Moujaes (Eli's nephew) as daily user.

- **Strategy:** Demo-first. Fake leads. Show client. Get sign-off. Swap credentials. Invoice.
- **Budget:** $2,000 client / ~$1,800 after fees
- **Client cost:** ~$28-35/month (Supabase + Twilio + n8n + Claude API)

## Stack

| Layer | Tool |
|-------|------|
| Database + Auth | Supabase (Postgres), RLS enabled |
| Frontend | Vite + React 19 + Tailwind v4 |
| Automation | n8n (5 SMS workflows spec'd + WF06 form intake built) |
| SMS | Twilio |
| Email | Resend (auto-reply emails from form intake) |
| AI | Claude API (Haiku) |
| Hosting | Vercel via GitHub |

## Key Files (read on-demand, not preloaded)

| What | Where |
|------|-------|
| Full DB schema | `supabase/schema.sql` |
| RLS policies | `supabase/002_rls_role_based.sql` |
| Companies + activity migration | `supabase/003_companies_activity.sql` |
| n8n workflow spec | `workflows/eli-doueri/sms-lead-funnel.md` |
| n8n JSON exports | `workflows/eli-doueri/n8n/*.json` |
| Form embed JS | `public/embed/dealercrm-form.js` |
| Mock dealership site | `public/embed/mock-dealership.html` |
| Architecture reference | `SYSTEM_CONTEXT.md` |
| Client details | `context/client.md` |
| Discovery call notes | `context/discovery-call-notes.md` |
| Proposal email thread | `context/proposal-email.md` |
| Shared constants | `src/lib/constants.js` |
| Supabase client | `src/lib/supabase.js` |
| Auth context | `src/lib/ProfileContext.jsx` |

## Frontend Pages (all in `src/pages/`)

Login, Leads, LeadDetail, Pipeline, Dashboard, Team, Schedule, Inventory

## What's Built — Form Intake Pipeline

- **Embeddable form** (`public/embed/dealercrm-form.js`) — shadow DOM, `data-company-id` + `data-webhook-url` attrs
- **Mock site** (`public/embed/mock-dealership.html`) — test page with the form embed
- **n8n WF06** (`workflows/eli-doueri/n8n/06-form-intake-email.json`) — form → lead insert → activity log → Claude email → Resend → respond
- **DB migration** (`supabase/003_companies_activity.sql`) — `companies` table, `activity_log` table, `company_id` on leads
- **Activity tab** in LeadDetail.jsx — timeline of form_submitted, ai_auto_reply_sent, email_opened, email_clicked events

## What's NOT Built Yet

1. n8n SMS workflows (01-05) — see `workflows/eli-doueri/sms-lead-funnel.md`
2. SMS Templates page — CRUD for `templates` table
3. Per-rep reporting — line chart in Dashboard
4. Vercel deploy — push latest, confirm live URL
5. Resend webhooks — track email opens/clicks → activity_log
6. Twilio SMS integration for form leads (currently email-only)

## Tools

- `tools/simulate_lead.py` — fire fake leads at n8n WF01 webhook
- `tools/test_claude_prompt.py` — test Claude SMS prompt locally
- `tools/test_form_pipeline.py` — test WF06 form intake pipeline

## Environment Variables

See `.env.example`. Frontend uses `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. Server-side (n8n only): `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `TWILIO_*`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.

## Communication Rules

Rules in `.claude/rules/`. Default: bullet points, short, casual internally, professional externally.

## Skills Architecture

Skills are bundled capabilities: instructions (SKILL.md) + scripts. They separate decision-making from execution.

**How it works:**
1. Skills live in `.claude/skills/` — each has a `SKILL.md` with instructions
2. You (the agent) route to the right skill based on the task
3. Skills have their own rules and constraints (e.g., file read budgets)

### Available Skills

| Skill | When to use |
|-------|-------------|
| `plan` | Planning features or multi-step work. Enforces 5-file read budget. |

### Self-Annealing

When something breaks:
1. Fix the script/code
2. Test it
3. Update the relevant SKILL.md or agent definition with what you learned

Don't create new skills without asking Kaleel first.

## Agents

Agents live in `.claude/agents/`. They're focused sub-agents for specific tasks.

| Agent | Purpose |
|-------|---------|
| `codebase-explorer` | Answer specific questions about the codebase. Max 5 file reads. |

### Build Workflow (for non-trivial code changes)

1. **Write/edit the code**
2. **Test** — run the app or relevant checks
3. **Fix** — if something broke, fix it before moving on
4. Only spawn agents for specific questions, never for broad exploration

## How to Run

```bash
npm install && npm run dev  # → http://localhost:5173
```

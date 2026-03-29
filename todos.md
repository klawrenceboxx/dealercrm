# DealerCRM — Todos

## Phase 1 — Infrastructure (nothing works without this)

- [ ] Create Supabase project at supabase.com → run `supabase/schema.sql` → add `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` to `.env`
- [ ] Seed demo data — 15 fake leads across all stages + `sms_log` entries so app looks live
- [ ] Build login page (email + password via Supabase Auth)
- [ ] Add auth gate to `App.jsx` — redirect to `/login` if no session
- [ ] Push to GitHub → connect Vercel → verify live URL works

## Phase 2 — AutoRaptor Feature Parity

- [ ] **New Lead form/modal** — AutoRaptor's most-used feature; reps add walk-ins manually
- [ ] **Lead editing** — name, phone, email, vehicle editable in LeadDetail; AutoRaptor has full field editing
- [ ] **Follow-up queue view** — filter leads where `next_follow_up` is overdue; this is AutoRaptor's daily driver for reps
- [ ] **Lead assignment** — `assigned_to` field (schema + UI); AutoRaptor is built around assigning leads to salespeople
- [ ] **Manual SMS button** — in LeadDetail, reps can send a one-off message without waiting for automation; AutoRaptor has this
- [ ] **Inventory management page** — Sleiman needs to add/edit/remove vehicles without touching Supabase UI directly
- [ ] **Opt-out / STOP indicator** — show compliance status clearly in LeadDetail; AutoRaptor surfaces this
- [ ] **Sidebar polish** — active nav state, logout button, user email display

## Phase 3 — n8n Automation (the "wow" moment for demo)

- [ ] Build WF01 — Lead Intake (webhook → normalize → dedup check → Supabase insert → trigger WF02)
- [ ] Build WF02 — AI SMS Engine (get lead + inventory → Claude Haiku → Twilio SMS → Supabase log → intent score)
- [ ] Build WF03 — Inbound SMS Handler (Twilio webhook → Claude classify → opt-out check → AI reply → Supabase update)
- [ ] Build WF04 — Sequence Scheduler (cron 15min → query overdue leads → trigger WF02)
- [ ] Build WF05 — Hot Lead Alert (SMS + email to salesperson → dedup guard via `salesperson_alerted`)
- [ ] End-to-end test: `python tools/simulate_lead.py` → lead appears in UI → SMS logs in Supabase
- [ ] Test Claude prompt quality: `python tools/test_claude_prompt.py --all`

## Phase 4 — Go Live

- [ ] Switch `demo_mode = false` on all leads, configure real Twilio number
- [ ] Point website form POST to WF01 webhook URL
- [ ] Connect Meta Lead Ads to WF01 via n8n HTTP trigger
- [ ] Get salesperson name, phone, email from Sleiman → add to n8n env vars
- [ ] Get dealership name, hours, city from Sleiman → update Claude system prompt
- [ ] Initial inventory list from Sleiman → load into `inventory` table
- [ ] Update `workflows/eli-doueri/sms-lead-funnel.md` — remove Airtable references, reflect final Supabase setup
- [ ] Demo to Sleiman — Loom walkthrough → get sign-off → invoice

## Completed

- [x] Project scaffolded — Vite + React + Tailwind v4 + Supabase JS
- [x] All 4 pages built — Leads, LeadDetail, Pipeline, Dashboard
- [x] Supabase schema written — `supabase/schema.sql`
- [x] Tools built — `simulate_lead.py`, `test_claude_prompt.py`
- [x] Workflow SOPs written — `sms-lead-funnel.md`, `go-live-migration.md`
- [x] CLAUDE.md written with full project context
- [x] Git initialized, first commit made

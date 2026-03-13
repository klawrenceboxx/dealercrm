# DealerCRM — Todos

## Active

- [ ] Create Supabase project at supabase.com → run `supabase/schema.sql` → add VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY to .env
- [ ] Run `npm run dev` and verify all 4 pages load without errors
- [ ] Push to GitHub → connect Vercel → verify live deploy
- [ ] Add Supabase Auth: login page + session guard (redirect to /login if not authenticated)
- [ ] Build n8n Workflow 01 (Lead Intake) — spec in `workflows/eli-doueri/sms-lead-funnel.md`
- [ ] Build n8n Workflow 02 (AI SMS Engine) — Claude Haiku + Twilio
- [ ] Build n8n Workflow 04 (Sequence Scheduler) — cron every 15min
- [ ] Build n8n Workflow 03 (Inbound SMS Handler)
- [ ] Build n8n Workflow 05 (Hot Lead Alert)
- [ ] Test end-to-end: `python tools/simulate_lead.py` → lead in Supabase → visible in UI
- [ ] Test Claude prompt quality: `python tools/test_claude_prompt.py --all`
- [ ] Demo to Sleiman — Loom walkthrough

## Completed

- [x] Project scaffolded — Vite + React + Tailwind v4 + Supabase JS
- [x] All 4 pages built — Leads, LeadDetail, Pipeline, Dashboard
- [x] Supabase schema written — `supabase/schema.sql`
- [x] Tools migrated — simulate_lead.py, test_claude_prompt.py
- [x] Workflow SOPs migrated — sms-lead-funnel.md, go-live-migration.md
- [x] CLAUDE.md written with full project context
- [x] Git initialized, first commit made

# Client Context — Eli Doueri / Car Dealership

## People

| Person | Role | Contact |
|--------|------|---------|
| Eli Doueri | Owner — car dealership + Cam Auto Pro | mr.doueri@gmail.com |
| Sleiman Moujaes | Eli's nephew — day-to-day contact for this project | TBD |

**Decision chain:** Eli is the decision-maker and final authority. Sleiman is the day-to-day user and technical point of contact, but does not hold approval power.

**Relationship history:** Kaleel previously built Eli's Shopify store (Cam Auto Pro — PDR tools). This is the second project together. Eli reached out on Upwork specifically to Kaleel — messaged him out of ~20 applicants.

## Dealership Details

- **Location:** Quebec, Canada (English-speaking — Eli and Sleiman speak English, know some French)
- **Lead volume:** 150-200 leads/month
- **Lead sources:** Website form + Meta (Facebook/Instagram) Lead Ads
- **Current CRM:** AutoRaptor — no API, team is unhappy with it
- **Sales process:** Leads come in, sales team needs to follow up fast, move them through the pipeline

## Discovery Call — Feb 2, 2026

Call with Sleiman (Eli's nephew). Key things confirmed:

**Scope:**
- Instant AI-driven SMS when a lead comes in (within minutes)
- 30-day follow-up sequence with reply/no-reply branching
- Inventory-aware AI responses (knows what's on the lot)
- Hot lead detection — salesperson gets an SMS + email alert immediately
- Full replacement of AutoRaptor — not a sidecar, the whole thing

**CRM requirements (what Sleiman needs):**
- See all incoming leads in one place
- View full lead history (SMS thread, notes, pipeline stage)
- Move leads through stages (New → Contacted → Warm → Hot → Closed)
- Know which leads need follow-up
- Basic reporting — where leads come from, conversion rate

**Technical decisions made on the call:**
- Originally proposed ADF push to AutoRaptor — dropped when direction changed to full replacement
- Supabase replaces AutoRaptor as the data layer
- Custom React frontend replaces AutoRaptor's UI
- n8n handles all automation (Kaleel already has the workflow map built)

**What Kaleel needs from Sleiman at go-live:**
- Website form config access (to point the form POST at n8n webhook)
- Meta Business Manager access (to connect Meta Lead Ads to n8n)
- Twilio account (or approval for Kaleel to create one)
- Salesperson name, phone, email (for hot lead alerts)
- Dealership name, hours, city (for Claude system prompt)
- Initial inventory list (CSV or manual entry)

## Project History

| Date | Event |
|------|-------|
| Jan 2026 | Eli posted Upwork job (AutoRaptor replacement / SMS lead funnel) |
| Jan 2026 | Kaleel applied with Loom walkthrough — Eli messaged him out of ~20 applicants |
| Jan 26, 2026 | Eli returned from vacation, asked Kaleel to call directly |
| Feb 2, 2026 | Discovery call with Sleiman — full scope confirmed |
| Mar 12, 2026 | Confirmed as active project, stack decided (Supabase + React + n8n) |
| Mar 12, 2026 | Frontend scaffolded, schema written, tools built |

## Strategy

**Demo-first.** Build the full system with simulated leads (demo mode — no real SMS). Record a Loom walkthrough. Show Eli (decision-maker) it works — Sleiman may be looped in too. Get Eli's approval. Swap in real credentials (8 config changes). Invoice after demo is approved.

**No upfront invoice.** This is spec work to close the deal.

**Budget:** $2,000 client / ~$1,800 after Upwork fees.

**Productization play:** The same stack (Supabase + n8n + React + Twilio) works for any car dealership. Once this is live, pitch other dealerships as a productized offering. Setup fee ($500-800) + monthly retainer ($150-200/month). Running cost is ~$30-50/month per client.

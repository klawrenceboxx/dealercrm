# SYSTEM_CONTEXT.md — DealerCRM Master Briefing

> This document is a comprehensive architectural reference for the DealerCRM application. Feed it to any LLM, contractor, or teammate who needs full context on how this system works.

---

## 1. Project Overview & Goals

**DealerCRM** is a custom CRM web application built to fully replace AutoRaptor for a car dealership in Quebec, Canada. The client (Eli Doueri, owner of Style Auto) pays ~$400 USD/month for AutoRaptor and wants to own his own system with no vendor lock-in.

**Target users:** Dealership sales reps and managers (primary daily user: Sleiman Moujaes, Eli's nephew).

**Core value proposition:**
- AI-driven SMS lead qualification and 30-day automated follow-up sequences
- Instant first-touch response (within minutes of form submission)
- Inventory-aware AI responses (knows what's on the lot, never lies about availability)
- Hot lead detection with real-time salesperson alerts
- Role-based access (managers see cost/margin data; reps don't)
- Full replacement of AutoRaptor's daily workflow: lead inbox, pipeline kanban, appointment scheduling, team management

**Business model:** Demo-first spec work. Built with simulated leads. Client sees a working demo, approves, credentials are swapped to production, then invoiced ($2,000). The stack is designed to be productizable for other dealerships (setup fee + monthly retainer).

**Client running cost:** ~$28-35/month (Supabase $0-25 + Twilio ~$8 + n8n $0-20 + Claude API ~$0.02)

**Lead volume:** 150-200 leads/month from website forms and Meta (Facebook/Instagram) Lead Ads.

---

## 2. Tech Stack

| Layer | Technology | Version / Notes |
|-------|-----------|-----------------|
| **Frontend framework** | React | v19 (via Vite) |
| **Build tool** | Vite | Fast HMR, `VITE_` env prefix for public vars |
| **Styling** | Tailwind CSS | v4 (utility-first, dark theme) |
| **Typography** | Outfit | Google Font, applied globally |
| **Icons** | Lucide React | Tree-shakeable icon library |
| **Routing** | React Router DOM | v7, client-side routing |
| **Database** | Supabase (PostgreSQL) | Hosted. RLS enabled on all tables. |
| **Authentication** | Supabase Auth | Email/password. Session-based. |
| **Automation engine** | n8n | 5 workflows (spec complete, not yet built) |
| **SMS provider** | Twilio | Sandbox for demo, production for go-live |
| **AI model** | Claude Haiku (`claude-haiku-4-5-20251001`) | SMS generation + intent classification |
| **Hosting** | Vercel | GitHub integration, auto-deploy on push |
| **State management** | React Context (ProfileContext) + page-level `useState` | No Redux/Zustand — intentionally minimal |

### Key Dependencies (`package.json`)

```
react, react-dom, react-router-dom, @supabase/supabase-js, lucide-react, tailwindcss
```

---

## 3. Database Schema & Entities

All tables live in a single Supabase (PostgreSQL) project. Schema is defined in `supabase/schema.sql`.

### 3.1 Entity Relationship Map

```
profiles (sales reps/managers)
  ├── 1:N → leads.assigned_to
  ├── 1:N → appointments.assigned_to
  ├── 1:N → tasks.assigned_to
  └── 1:N → templates.created_by

leads (core entity)
  ├── 1:N → sms_log.lead_id
  ├── 1:N → notes.lead_id
  ├── 1:N → appointments.lead_id
  └── 1:N → tasks.lead_id

inventory (standalone — referenced by AI prompt, not FK-linked to leads)

settings (key-value config store — used by n8n for round-robin counter)
```

### 3.2 Table Definitions

#### `leads` — Core lead record + sequence state

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID (PK) | Primary key |
| `lead_id` | TEXT (unique) | Legacy UUID from n8n intake |
| `first_name`, `last_name` | TEXT | Lead's name |
| `phone` | TEXT | E.164 format (e.g., `+15145551234`) |
| `email` | TEXT | Optional |
| `source` | TEXT | `website` or `meta` |
| `vehicle_interest` | TEXT | Free text (e.g., "2024 Toyota Camry LE") |
| `trade_in_vehicle`, `trade_in_year`, `trade_in_notes` | TEXT/INT | Trade-in details (editable in LeadDetail) |
| `stage` | TEXT | Pipeline position (see Section 7.2) |
| `intent_score` | TEXT | `cold`, `warm`, or `hot` (Claude-classified) |
| `sequence_step` | INT (0-4) | Current position in 30-day follow-up sequence |
| `next_follow_up` | TIMESTAMPTZ | When the scheduler should fire the next SMS |
| `last_reply_at` | TIMESTAMPTZ | When the lead last replied |
| `last_sms_at` | TIMESTAMPTZ | When the last outbound SMS was sent |
| `sms_count` | INT | Total outbound SMS sent to this lead |
| `opted_out` | BOOLEAN | TCPA compliance flag — blocks all future SMS |
| `salesperson_alerted` | BOOLEAN | Dedup flag for hot lead alerts |
| `demo_mode` | BOOLEAN | If true, SMS is suppressed (logged as `[DEMO]`) |
| `assigned_to` | UUID (FK → profiles.id) | Assigned sales rep |
| `created_at` | TIMESTAMPTZ | Record creation time |

Index: `idx_leads_next_follow_up` on `next_follow_up` (for scheduler query performance).

#### `sms_log` — Inbound/outbound SMS thread per lead

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID (PK) | |
| `lead_id` | UUID (FK → leads.id) | |
| `direction` | TEXT | `outbound` or `inbound` |
| `body` | TEXT | SMS message content |
| `sent_at` | TIMESTAMPTZ | When the message was sent/received |
| `intent_score` | TEXT | Claude's classification at time of send |
| `trigger_type` | TEXT | What caused this SMS (e.g., `first_contact`, `follow_up_day3`, `inbound_reply`) |
| `demo` | BOOLEAN | True if SMS was suppressed in demo mode |

#### `notes` — Manual notes per lead

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID (PK) | |
| `lead_id` | UUID (FK → leads.id) | |
| `content` | TEXT | Note body |
| `created_at` | TIMESTAMPTZ | |

#### `appointments` — Scheduled appointments

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID (PK) | |
| `lead_id` | UUID (FK → leads.id) | |
| `assigned_to` | UUID (FK → profiles.id) | |
| `scheduled_at` | TIMESTAMPTZ | Appointment date/time |
| `status` | TEXT | `scheduled`, `in_progress`, `kept`, `missed`, `cancelled` |
| `vehicle` | TEXT | Vehicle being discussed |
| `notes` | TEXT | Appointment notes |

#### `tasks` — To-do items per lead

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID (PK) | |
| `lead_id` | UUID (FK → leads.id) | |
| `assigned_to` | UUID (FK → profiles.id) | |
| `title` | TEXT | Task description |
| `due_date` | DATE | |
| `completed` | BOOLEAN | |
| `completed_at` | TIMESTAMPTZ | |

#### `inventory` — Vehicles on the lot

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID (PK) | |
| `vehicle` | TEXT | Full string (e.g., "2024 Toyota Camry LE") |
| `year`, `make`, `model`, `trim`, `color` | TEXT/INT | Parsed vehicle details |
| `mileage` | INT | Odometer reading in km |
| `price` | NUMERIC | Listed sale price |
| `status` | TEXT | `available`, `pending`, `sold` |
| `stock_number`, `vin` | TEXT | Dealer identifiers |
| `purchase_price`, `repair_cost` | NUMERIC | Manager-only cost data |
| `repair_notes` | TEXT | What needs fixing |
| `at_mechanic` | BOOLEAN | Currently at a repair shop |
| `mechanic_name` | TEXT | Which shop |

#### `profiles` — Sales reps and managers

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID (PK, FK → auth.users.id) | Tied to Supabase Auth user |
| `name` | TEXT | Display name |
| `phone` | TEXT | Rep's phone |
| `role` | TEXT | `manager` or `rep` |
| `active` | BOOLEAN | Whether this rep receives new lead assignments |
| `rr_order` | INT | Round-robin assignment priority |

#### `settings` — Key-value configuration

| Column | Type | Purpose |
|--------|------|---------|
| `key` | TEXT (PK) | Setting name |
| `value` | JSONB | Setting value |

Default: `{ key: "rr_index", value: 0 }` — round-robin counter for lead assignment.

#### `templates` — SMS template library (not yet wired to frontend)

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID (PK) | |
| `name` | TEXT | Template name |
| `body` | TEXT | Template content |
| `created_by` | UUID (FK → profiles.id) | |
| `created_at` | TIMESTAMPTZ | |

### 3.3 Row-Level Security (RLS)

- All tables have RLS enabled
- Policy: authenticated users have full read/write access (`auth.role() = 'authenticated'`)
- n8n bypasses RLS using `SUPABASE_SERVICE_ROLE_KEY` (server-side only, never exposed to frontend)
- Frontend uses the anon key + Supabase Auth session token

---

## 4. Data Flow & State Management

### 4.1 Frontend Data Flow

```
Supabase Auth Session
  └── ProfileContext (React Context)
        └── Wraps all pages
              └── Each page fetches its own data via supabase.from().select()
                    └── Local useState for loading, forms, filters, modals
                          └── Mutations via supabase.from().insert() / .update()
                                └── Re-fetch after mutation (no optimistic updates)
```

**Key patterns:**
- **No global state library.** Each page owns its data lifecycle.
- **ProfileContext** is the only shared context. It provides `{ profile, setProfile, profileLoading }` and auto-creates a profile row (role: `rep`) on first login if one doesn't exist.
- **Supabase client** (`src/lib/supabase.js`) is a singleton created with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- **No real-time subscriptions.** All data is fetched on page mount via `useEffect`. No WebSocket/Realtime channels are configured.
- **No optimistic updates.** After a mutation (insert/update), the component re-fetches the full dataset.

### 4.2 Page-Specific Data Flows

| Page | Reads | Writes |
|------|-------|--------|
| **Leads** | `leads` (with filter/search), `profiles` (for assignee names) | `leads` (manual add via modal) |
| **LeadDetail** | `leads`, `sms_log`, `notes`, `appointments`, `tasks`, `profiles` | `leads` (stage/assignee/trade-in update), `notes`, `appointments`, `tasks` |
| **Pipeline** | `leads` (grouped by stage) | `leads` (inline stage change via dropdown) |
| **Dashboard** | `leads` (aggregate stats, date-range filtered) | None |
| **Team** | `profiles` | `profiles` (edit modal — manager-only) |
| **Schedule** | `appointments` (filtered by week), `leads` (for names) | None (creation happens in LeadDetail) |
| **Inventory** | `inventory` | `inventory` (add/edit modal) |

### 4.3 Constants & UI Config

Defined in `src/lib/constants.js` and used across all pages for consistent styling:

```javascript
STAGE_LIST = ["new", "needs_reply", "contacted", "warm", "hot", "lost", "closed", "unsubscribed"]
STAGE_LABELS = { new: "New", needs_reply: "Needs Reply", contacted: "Contacted", ... }
STAGE_COLORS = { new: "bg-slate-100 text-slate-600", hot: "bg-red-100 text-red-700", ... }
INTENT_COLORS = { cold: "text-slate-400", warm: "text-amber-600", hot: "text-red-600" }
INTENT_DOT = { cold: "bg-slate-300", warm: "bg-amber-400", hot: "bg-red-500" }
```

---

## 5. AI & Middleware Architecture (n8n)

The automation layer runs entirely in n8n (workflow automation platform). It is **fully specified but not yet built**. The complete node-by-node specification lives in `workflows/eli-doueri/sms-lead-funnel.md`.

### 5.1 Workflow Overview

```
                    ┌─────────────────┐
   Website Form ───►│ [01] Lead Intake │──► Supabase INSERT
   Meta Lead Ads ──►│   (Webhook)      │──► Trigger [02]
                    └─────────────────┘
                              │
                              ▼
                    ┌──────────────────────┐
                    │ [02] AI SMS Engine    │◄── Also called by [04] Scheduler
                    │   Claude Haiku API   │
                    │   Twilio Send SMS    │──► sms_log INSERT
                    │   Update lead state  │──► If hot → Trigger [05]
                    └──────────────────────┘
                              ▲
    Twilio Inbound ──►┌───────────────────────┐
      (customer SMS)  │ [03] Inbound Handler   │
                      │   Opt-out check        │
                      │   Claude classify      │──► Update lead stage/intent
                      │   Claude reply         │──► Twilio Send SMS
                      │   If hot → [05]        │
                      └───────────────────────┘

                    ┌──────────────────────────┐
                    │ [04] Sequence Scheduler   │ (Cron: every 15 min)
                    │   Query: next_follow_up   │──► For each due lead → [02]
                    │   <= now, not opted out   │
                    └──────────────────────────┘

                    ┌──────────────────────────┐
                    │ [05] Hot Lead Alert       │
                    │   SMS to salesperson      │──► Twilio
                    │   Email to salesperson    │──► Gmail
                    │   Mark salesperson_alerted│
                    └──────────────────────────┘
```

### 5.2 Workflow Details

#### Workflow 01: Lead Intake
- **Trigger:** Webhook (website form POST or Meta Lead Ads via n8n Facebook trigger)
- **Steps:** Normalize phone to E.164 → generate UUID `lead_id` → check for duplicate phone in Supabase → INSERT to `leads` table (stage=`new`, demo_mode=`true` by default) → POST to Workflow 02 with `{ lead_id, trigger_type: "first_contact" }`
- **Duplicate handling:** If phone already exists, update `last_seen` field, skip new record creation

#### Workflow 02: AI SMS Engine (core)
- **Trigger:** Webhook (called by 01, 03, and 04)
- **Input:** `{ lead_id, trigger_type }`
- **Steps:**
  1. Fetch lead record from Supabase
  2. Fetch available inventory from Supabase
  3. Build Claude prompt (system prompt + user message with lead context and trigger instructions)
  4. POST to Claude API (`claude-haiku-4-5-20251001`, max 256 tokens)
  5. Parse JSON response: `{ sms_text, intent_score, intent_reasoning }`
  6. If `demo_mode = false`: send SMS via Twilio
  7. If `demo_mode = true`: skip Twilio, prepend `[DEMO]` to logged message
  8. INSERT to `sms_log` (direction=`outbound`, trigger_type, demo flag)
  9. UPDATE lead: `last_sms_at`, `sms_count++`, `intent_score`, `stage`, `sequence_step++`, `next_follow_up`
  10. If `intent_score = "hot"`: POST to Workflow 05

#### Workflow 03: Inbound SMS Handler
- **Trigger:** Twilio webhook ("A message comes in")
- **Steps:**
  1. Find lead by phone number in Supabase
  2. Check for opt-out keywords (STOP, UNSUBSCRIBE, QUIT, CANCEL) — if found: mark `opted_out=true`, stage=`unsubscribed`, send confirmation, STOP
  3. Log inbound message to `sms_log` (direction=`inbound`)
  4. Update lead: `last_reply_at = now`
  5. Call Claude with `trigger_type = "inbound_reply"` + last 3 messages + new reply
  6. Branch on `intent_score`:
     - `hot` → stage=`hot`, POST to Workflow 05, send Claude reply
     - `warm` → stage=`warm`, clear `next_follow_up` (pause sequence), send Claude reply
     - `cold` → stage=`warm` (upgraded from cold since they replied), set `next_follow_up = now+3days`, send Claude reply
  7. Send SMS via Twilio
  8. Log outbound to `sms_log`

#### Workflow 04: Sequence Scheduler
- **Trigger:** Cron, every 15 minutes
- **Query:** `next_follow_up <= now AND opted_out = false AND stage NOT IN ('hot', 'closed', 'unsubscribed')`
- **For each result:** Map `sequence_step` to `trigger_type`, POST to Workflow 02
- **End of sequence:** If `sequence_step > 4`, set `stage = closed`

#### Workflow 05: Hot Lead Alert
- **Trigger:** Webhook (called by 02 or 03)
- **Steps:** Fetch lead → check `salesperson_alerted` (dedup) → SMS alert to salesperson via Twilio → email with full conversation log via Gmail → update lead: `salesperson_alerted = true`, stage=`hot`

### 5.3 n8n-to-Supabase Connection

n8n connects to Supabase via HTTP Request nodes using the service role key:
- URL: `https://[project-ref].supabase.co/rest/v1/[table]`
- Headers: `apikey: [SERVICE_ROLE_KEY]`, `Authorization: Bearer [SERVICE_ROLE_KEY]`
- This bypasses RLS (service role has full access)

### 5.4 Claude AI System Prompt

The system prompt injected into every Claude API call includes:

```
You are an AI assistant for {DEALERSHIP_NAME} in {DEALERSHIP_CITY}.
Sales contact: {SALESPERSON_NAME}, {SALESPERSON_PHONE}
Hours: {DEALERSHIP_HOURS}

CURRENT AVAILABLE INVENTORY:
{inventory list from Supabase}

RULES:
- SMS under 160 characters unless content truly requires more
- Professional but warm — not pushy, not robotic
- Never use em dashes
- No filler phrases ("Great question!", "Certainly!", etc.)
- Always include a clear next step or question
- Sign with salesperson first name on first contact only
- Never lie about inventory availability
- Respect STOP/UNSUBSCRIBE requests immediately

OUTPUT FORMAT: JSON only
{ "sms_text": "...", "intent_score": "hot|warm|cold", "intent_reasoning": "..." }
```

Each trigger type has specific instructions appended to the user message:

| Trigger | Instruction |
|---------|-------------|
| `first_contact` | Introduce yourself, reference vehicle interest, ask one qualifying question, sign with first name |
| `follow_up_day3` | Short friendly check-in, one question, under 100 chars if possible |
| `follow_up_day7` | Different angle — ask about timing or budget, not the specific vehicle |
| `follow_up_day14` | Last real attempt, keep it human and low-pressure |
| `follow_up_day30` | Final follow-up, acknowledge time has passed, leave door open |
| `inbound_reply` | Respond naturally to what they said, classify intent |

---

## 6. Third-Party Integrations

| Service | Purpose | Connection Method | Status |
|---------|---------|-------------------|--------|
| **Supabase** | Database, auth, RLS | `@supabase/supabase-js` client (frontend) + REST API with service role key (n8n) | Live |
| **Twilio** | Send/receive SMS | Twilio API (from n8n), inbound webhook pointing to Workflow 03 | Configured, not live |
| **Claude API (Anthropic)** | SMS text generation + intent classification | HTTP POST to `api.anthropic.com/v1/messages` (from n8n) | Tested locally |
| **Vercel** | Frontend hosting | GitHub integration, auto-deploy on push to `master` | Live |
| **Gmail** | Hot lead email alerts to salesperson | Gmail API or SMTP (from n8n Workflow 05) | Not yet built |
| **Meta Lead Ads** | Lead source — Facebook/Instagram ad forms | n8n Facebook Lead Ads trigger node or webhook bridge | Not yet connected |
| **Website form** | Lead source — dealership website | POST to n8n Workflow 01 webhook URL | Not yet connected |

### Environment Variables

```
# Frontend (Vite — public, safe to expose)
VITE_SUPABASE_URL=https://[ref].supabase.co
VITE_SUPABASE_ANON_KEY=...

# Server-side only (n8n — NEVER in frontend)
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=...

# n8n webhook URLs (set after building workflows)
N8N_WEBHOOK_INTAKE=...
N8N_WEBHOOK_SMS_ENGINE=...
N8N_WEBHOOK_HOT_LEAD=...

# n8n environment variables (business config)
SALESPERSON_NAME, SALESPERSON_PHONE, SALESPERSON_EMAIL
DEALERSHIP_NAME, DEALERSHIP_HOURS, DEALERSHIP_CITY
```

---

## 7. Core Business Logic & Rules

### 7.1 Lead Routing / Round-Robin Assignment

- On intake (Workflow 01), new leads are assigned to active sales reps in round-robin order
- Assignment priority is determined by `profiles.rr_order` (lower = assigned first)
- Only active reps (`profiles.active = true`) are included in the rotation
- A counter (`settings.rr_index`) tracks the current position in the rotation
- n8n increments this counter after each assignment
- Manual reassignment is available in the LeadDetail page (assignee dropdown)

### 7.2 Pipeline Stage Definitions

Leads move through 8 stages:

| Stage | Meaning | How a lead enters |
|-------|---------|-------------------|
| `new` | Just arrived, no outbound SMS yet | Workflow 01 sets this on intake |
| `needs_reply` | Outbound SMS sent, waiting for customer response | Set after first outbound SMS |
| `contacted` | Initial contact made, conversation started | Set after first exchange |
| `warm` | Lead is engaged, asking questions, comparing options | Claude classifies intent as warm; or any inbound reply upgrades from cold |
| `hot` | Ready to buy — asking about price, availability, test drives | Claude classifies intent as hot |
| `lost` | Lead went cold, no deal | Manual stage change by rep |
| `closed` | Deal completed OR sequence exhausted (30 days, no reply) | Manual (deal done) or automatic (sequence_step > 4) |
| `unsubscribed` | Lead sent STOP/UNSUBSCRIBE | Workflow 03 opt-out handler |

### 7.3 AI Autopilot Logic

The AI operates autonomously via n8n workflows. Here is how the autopilot engages and disengages:

#### When the AI is active (autopilot ON):
- **First contact:** Immediately after lead intake (Workflow 01 triggers Workflow 02)
- **Scheduled follow-ups:** Every 15 minutes, the scheduler (Workflow 04) checks for leads where `next_follow_up <= now` and sends the next message in the sequence
- **Inbound replies:** When a customer texts back, the inbound handler (Workflow 03) auto-classifies and auto-replies

#### 30-Day Follow-Up Sequence:

| Step | Trigger Type | Days After Previous | Next Follow-Up Set To |
|------|-------------|--------------------|-----------------------|
| 0 | `first_contact` | Immediate | now + 3 days |
| 1 | `follow_up_day3` | 3 days | now + 4 days |
| 2 | `follow_up_day7` | 4 days | now + 7 days |
| 3 | `follow_up_day14` | 7 days | now + 16 days |
| 4 | `follow_up_day30` | 16 days | null (sequence ends) |

After each send: `sequence_step++`, `sms_count++`, `next_follow_up` updated.

#### Kill-switch / Handoff triggers (autopilot OFF):

| Trigger | What happens | Why |
|---------|-------------|-----|
| **Intent = hot** | Workflow 05 fires: SMS + email alert to salesperson. Stage set to `hot`. Sequence paused (`next_follow_up` cleared on warm/hot inbound). | Human should take over — lead is ready to buy |
| **Opt-out keyword** (STOP, UNSUBSCRIBE, QUIT, CANCEL) | `opted_out = true`, stage = `unsubscribed`, confirmation SMS sent, all future outbound blocked | TCPA compliance — legally required |
| **Sequence exhausted** (step > 4) | Stage set to `closed`, `next_follow_up = null` | 30-day sequence complete with no engagement |
| **Warm/hot inbound reply** | `next_follow_up` cleared (pauses automated sequence). AI still auto-replies to this specific message, but no further scheduled follow-ups fire. | Lead is now in active conversation — rep should monitor |
| **Manual stage change to `lost`** | Lead remains in database but scheduler skips it (stage filter excludes `lost`) | Rep decided this lead isn't viable |

**Important:** The AI never "sells." Its job is to qualify, move the conversation forward, and book appointments or hand off to a human. The salesperson is always alerted when a lead goes hot.

### 7.4 Opt-Out Compliance (TCPA)

- Workflow 03 checks every inbound message for keywords: STOP, UNSUBSCRIBE, QUIT, CANCEL (case-insensitive, checked before any other processing)
- On match: `opted_out = true`, `stage = unsubscribed`, confirmation sent: "You've been unsubscribed from [DEALERSHIP]. Text START to re-subscribe."
- Scheduler (Workflow 04) filters: `opted_out = false`
- No outbound SMS can be sent to an opted-out lead

### 7.5 Demo Mode

- `leads.demo_mode` (boolean, default `true` during development)
- When `true`: Twilio SMS is NOT sent. Message is prepended with `[DEMO]` and logged to `sms_log` with `demo = true`
- The full workflow executes (Claude generates the message, lead state updates, sequence advances) — only the actual SMS send is suppressed
- Go-live: set default to `false` in Workflow 01

### 7.6 Role-Based Access

| Feature | Manager | Rep |
|---------|---------|-----|
| View all leads | Yes | Yes |
| Edit lead stage/assignee | Yes | Yes |
| View inventory (basic) | Yes | Yes |
| View inventory costs (purchase price, repair cost, margin) | Yes | No |
| Add/edit inventory with cost fields | Yes | No |
| Edit team profiles (name, role, active, rr_order) | Yes | No |
| View dashboard | Yes | Yes |
| Create notes/appointments/tasks | Yes | Yes |

Access control is enforced in the React frontend by checking `profile.role` from ProfileContext. The database RLS policy does not distinguish between roles (both have full access) — role-based restrictions are UI-level only.

---

## 8. Directory Structure

```
dealercrm/
├── src/
│   ├── App.jsx              # Root: sidebar, routing, ProfileProvider
│   ├── main.jsx             # Vite entry point
│   ├── index.css            # Global styles, Outfit font
│   ├── lib/
│   │   ├── supabase.js      # Supabase client singleton
│   │   ├── constants.js     # Stage/intent colors, labels, lists
│   │   └── ProfileContext.jsx  # Auth user profile context
│   └── pages/
│       ├── Login.jsx        # Supabase email/password auth
│       ├── Leads.jsx        # Lead table with search, filter, add modal
│       ├── LeadDetail.jsx   # Lead profile: info, SMS, notes, appointments, tasks
│       ├── Pipeline.jsx     # Kanban board by stage
│       ├── Dashboard.jsx    # Analytics: stat cards, charts, breakdowns
│       ├── Team.jsx         # Rep management (manager-only edit)
│       ├── Schedule.jsx     # Weekly appointment calendar
│       └── Inventory.jsx    # Vehicle management with role-based cost visibility
├── supabase/
│   └── schema.sql           # Full PostgreSQL schema (applied to live project)
├── workflows/
│   └── eli-doueri/
│       ├── sms-lead-funnel.md   # Node-by-node n8n workflow specification
│       └── go-live-migration.md # 10-step production migration checklist
├── tools/
│   ├── test_claude_prompt.py    # Test Claude SMS prompt locally
│   ├── simulate_lead.py        # Fire fake leads at n8n webhook
│   └── deploy_n8n_workflows.py # n8n deployment helper
├── context/                     # Project history and client docs
├── .env                         # Secrets (gitignored)
├── .env.example                 # Template
├── package.json
├── vite.config.js
└── CLAUDE.md                    # Project assistant context
```

---

## 9. Build Status

| Component | Status | Notes |
|-----------|--------|-------|
| Database schema (9 tables) | Complete | Live on Supabase, RLS enabled, demo data seeded |
| Frontend (8 pages) | Complete | Deployed to Vercel, all CRUD operations working |
| Authentication | Complete | Supabase Auth, email/password, ProfileContext |
| Claude SMS prompt | Tested | `test_claude_prompt.py` validates all 5 trigger types |
| n8n workflows (5 total) | Not built | Full spec in `sms-lead-funnel.md` |
| Twilio integration | Not wired | Credentials configured, actual send happens in n8n |
| Meta Lead Ads connection | Not connected | Requires Sleiman's Meta Business Manager access |
| Website form connection | Not connected | Requires Sleiman's webmaster to point form at webhook |
| SMS Templates page | Not built | Table exists, no frontend CRUD yet |
| Go-live migration | Documented | 10-step checklist in `go-live-migration.md` |

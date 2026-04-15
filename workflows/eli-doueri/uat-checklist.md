# DealerCRM — User Acceptance Testing (UAT) Checklist

## Prerequisites

- [ ] All 5 n8n workflows imported and activated
- [ ] n8n environment variables configured (see "Production Environment Variables" below)
- [ ] Twilio credentials configured in n8n
- [ ] Gmail OAuth connected in n8n for Workflow 05
- [ ] At least 1 inventory item in Supabase with status = `available`
- [ ] At least 1 active profile in Supabase with role = `manager`
- [ ] `demo_mode = true` on all test leads (safety net)

---

## TC-01: New Lead Intake (Workflow 01)

| # | Step | Expected Result | Pass |
|---|------|----------------|------|
| 1 | POST to WF01 webhook: `{ "first_name": "Test", "last_name": "Lead", "phone": "+15145550101", "source": "website", "vehicle_interest": "2024 Toyota Camry LE" }` | 200 OK with `{ "status": "ok", "lead_id": "..." }` | [ ] |
| 2 | Check Supabase `leads` table | New row: stage=`new`, intent_score=`cold`, sequence_step=`0`, autopilot_active=`true`, demo_mode=`true` | [ ] |
| 3 | Check `assigned_to` column | UUID of an active rep (round-robin assigned) | [ ] |
| 4 | Check `sms_log` table | One outbound row with trigger_type=`first_contact`, demo=`true`, body starts with `[DEMO]` | [ ] |
| 5 | Check lead was updated | `last_sms_at` set, `sms_count`=1, `sequence_step`=1, `next_follow_up` = ~3 days from now | [ ] |

## TC-02: Duplicate Phone Rejection

| # | Step | Expected Result | Pass |
|---|------|----------------|------|
| 1 | POST same phone `+15145550101` to WF01 webhook again | Response: `{ "status": "duplicate", "existing_id": "..." }` | [ ] |
| 2 | Check `leads` table | No second row created for that phone | [ ] |

## TC-03: Sequence Execution (Workflow 04 + 02)

| # | Step | Expected Result | Pass |
|---|------|----------------|------|
| 1 | Manually set test lead's `next_follow_up` to a past timestamp in Supabase | -- | [ ] |
| 2 | Wait up to 15 minutes (or manually trigger WF04) | WF04 picks up the lead, calls WF02 | [ ] |
| 3 | Check `sms_log` | New outbound row with trigger_type=`follow_up_day3` (step 1) | [ ] |
| 4 | Check lead state | `sequence_step` incremented, `next_follow_up` updated to ~4 days out | [ ] |
| 5 | Repeat for steps 2-4 (day7, day14, day30) | Each fires the correct trigger_type with correct next_follow_up | [ ] |
| 6 | After step 4 completes (sequence_step > 4) | Lead stage set to `closed`, `next_follow_up` = null, `autopilot_active` = false | [ ] |

## TC-04: Inbound Reply (Workflow 03)

| # | Step | Expected Result | Pass |
|---|------|----------------|------|
| 1 | POST to WF03 webhook: `{ "From": "+15145550101", "Body": "What's the price on the Camry?" }` | 200 OK | [ ] |
| 2 | Check `sms_log` | Two new rows: one `inbound` and one `outbound` (Claude's reply) | [ ] |
| 3 | Check lead | `last_reply_at` updated, `intent_score` updated (likely `warm` or `hot`), stage updated | [ ] |
| 4 | Verify Claude's reply references actual inventory | SMS text mentions Camry pricing from inventory table | [ ] |

## TC-05: Autopilot Off (Manual Takeover)

| # | Step | Expected Result | Pass |
|---|------|----------------|------|
| 1 | Set test lead's `autopilot_active = false` in Supabase | -- | [ ] |
| 2 | POST inbound message to WF03: `{ "From": "+15145550101", "Body": "Can I come in today?" }` | Response: `{ "status": "logged_only_autopilot_off" }` | [ ] |
| 3 | Check `sms_log` | One `inbound` row logged. NO outbound auto-reply generated. | [ ] |
| 4 | Check lead | `last_reply_at` updated, but stage/intent NOT changed by AI | [ ] |
| 5 | Set `next_follow_up` to past, wait for WF04 | Scheduler does NOT pick up this lead (filtered by `autopilot_active=eq.true`) | [ ] |

## TC-06: TCPA Opt-Out Compliance

| # | Step | Expected Result | Pass |
|---|------|----------------|------|
| 1 | POST to WF03: `{ "From": "+15145550101", "Body": "STOP" }` | Processed as opt-out | [ ] |
| 2 | Check lead | `opted_out = true`, `stage = unsubscribed`, `autopilot_active = false`, `next_follow_up = null` | [ ] |
| 3 | Check Twilio (or `sms_log` in demo) | Confirmation SMS sent: "You've been unsubscribed from {DEALERSHIP}. Text START to re-subscribe." | [ ] |
| 4 | Set `next_follow_up` to past, trigger WF04 | Scheduler does NOT pick up this lead | [ ] |
| 5 | Repeat test with keywords: `stop`, `UNSUBSCRIBE`, `quit`, `Cancel` | All recognized as opt-out (case-insensitive) | [ ] |

## TC-07: Hot Lead Alert (Workflow 05)

| # | Step | Expected Result | Pass |
|---|------|----------------|------|
| 1 | Create a lead with `salesperson_alerted = false` | -- | [ ] |
| 2 | Add 5+ sms_log entries for this lead | -- | [ ] |
| 3 | POST to WF05 webhook: `{ "lead_id": "<lead_uuid>" }` | Alert fires | [ ] |
| 4 | Check salesperson phone | SMS received with lead name, phone, vehicle, "Call them ASAP!" | [ ] |
| 5 | Check salesperson email | HTML email with lead details table + last 5 messages formatted with direction and timestamps | [ ] |
| 6 | Check lead in Supabase | `salesperson_alerted = true`, `stage = hot` | [ ] |
| 7 | POST to WF05 again with same lead_id | Alert does NOT fire again (dedup: `salesperson_alerted = true`) | [ ] |

## TC-08: Human Rep Handoff Sequence

| # | Step | Expected Result | Pass |
|---|------|----------------|------|
| 1 | Create lead, let AI send first_contact | Lead: stage=`needs_reply`, autopilot=`true` | [ ] |
| 2 | Simulate inbound reply classified as `hot` | Stage changes to `hot`, WF05 fires, salesperson alerted | [ ] |
| 3 | Rep opens LeadDetail in frontend, starts typing in manual SMS | Frontend auto-sets `autopilot_active = false` | [ ] |
| 4 | Another inbound message arrives at WF03 | Message logged, but NO auto-reply (autopilot off) | [ ] |
| 5 | Rep re-enables autopilot via toggle in LeadDetail | `autopilot_active = true` in Supabase | [ ] |
| 6 | Next inbound message | AI auto-replies normally | [ ] |

## TC-09: RLS Enforcement

| # | Step | Expected Result | Pass |
|---|------|----------------|------|
| 1 | Log in as a `rep` user in the frontend | -- | [ ] |
| 2 | Navigate to Inventory page | Vehicles visible, but `purchase_price` and `repair_cost` columns show null/blank | [ ] |
| 3 | Attempt to add a vehicle (if button visible) | Blocked by RLS (insert requires `manager` role) | [ ] |
| 4 | Navigate to Team page | Profiles visible, but edit controls hidden/disabled | [ ] |
| 5 | Log in as `manager` user | -- | [ ] |
| 6 | Navigate to Inventory page | Cost columns visible with actual values | [ ] |
| 7 | Add/edit a vehicle | Works (manager has insert/update) | [ ] |
| 8 | Edit a team member's profile | Works (manager policy allows) | [ ] |

## TC-10: Demo Mode vs. Live Mode

| # | Step | Expected Result | Pass |
|---|------|----------------|------|
| 1 | Send lead with `demo_mode = true` through WF01 → WF02 | SMS NOT sent via Twilio. sms_log shows `[DEMO]` prefix, `demo = true` | [ ] |
| 2 | Send lead with `demo_mode = false` through WF01 → WF02 | Actual SMS sent via Twilio. sms_log shows clean message, `demo = false` | [ ] |

---

## Production Environment Variables

All variables needed in n8n Settings > Variables for go-live:

### Supabase
| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | `https://ntohjufkraavvvarqiyq.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase Dashboard > Settings > API > service_role (secret) |

### Anthropic (Claude AI)
| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | From console.anthropic.com > API Keys |

### Twilio
| Variable | Description |
|----------|-------------|
| `TWILIO_ACCOUNT_SID` | From Twilio Console |
| `TWILIO_AUTH_TOKEN` | From Twilio Console |
| `TWILIO_FROM_NUMBER` | Purchased Canadian local number (E.164 format) |

### n8n Internal Webhook URLs
| Variable | Description |
|----------|-------------|
| `N8N_WEBHOOK_SMS_ENGINE` | WF02 production webhook URL (set after activating) |
| `N8N_WEBHOOK_HOT_LEAD` | WF05 production webhook URL (set after activating) |

### Business Configuration
| Variable | Description |
|----------|-------------|
| `DEALERSHIP_NAME` | From Sleiman (e.g., "Style Auto") |
| `DEALERSHIP_CITY` | From Sleiman (e.g., "Montreal, QC") |
| `DEALERSHIP_HOURS` | From Sleiman (e.g., "Mon-Sat 9am-6pm ET") |
| `SALESPERSON_NAME` | From Sleiman |
| `SALESPERSON_PHONE` | From Sleiman (E.164 format) |
| `SALESPERSON_EMAIL` | From Sleiman |

### Total: 14 environment variables

---

## Go-Live Switch (after UAT passes)

1. Set `demo_mode` default to `false` in WF01 Code node
2. Update all business config env vars with real values from Sleiman
3. Purchase Twilio Canada number, configure inbound webhook to WF03
4. Point website form POST to WF01 webhook URL
5. Connect Meta Lead Ads to WF01 (n8n Facebook trigger or webhook bridge)
6. Import initial inventory to Supabase
7. Run one real lead through the system end-to-end
8. Monitor n8n execution logs for 48 hours

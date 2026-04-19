# Schema Notes

## What This Wave Adds

- `profiles.role` check now accepts `owner` in addition to `rep`, `manager`, and `admin`.
- `leads` gains `is_hot`, `hot_flagged_at`, `last_rep_reply_at`, `last_lead_reply_at`, and `lost_reason`.
- `companies` gains `twilio_number`, `resend_sender`, `ai_tone`, and `sla_hours`.
- `inventory` gains `image_urls text[] default array[]::text[]`.
- New tables:
  - `messages`
  - `notifications`
  - `failed_deliveries`
- New owner-aware helper functions:
  - `public.is_owner()`
  - `public.is_manager_admin_or_owner()`
- `public.can_access_lead()` is extended so owner inherits manager/admin lead access.

## What Already Existed

- Core tables already existed: `profiles`, `leads`, `sms_log`, `notes`, `inventory`, `templates`, `crm_files`, `companies`, `activity_log`, `appointments`, `settings`, `tasks`.
- Existing helper functions already existed and were reused:
  - `public.user_role()`
  - `public.current_user_is_active()`
  - `public.is_manager_or_admin()`
  - `public.can_access_lead(uuid)`
  - `public.admin_set_user_suspension(uuid, bool)`
  - `public.admin_delete_user_account(uuid)`
- `leads` already used `first_name` / `last_name`.
- `sold_price` already existed and was left in place instead of introducing `closed_value`.
- `sms_log` remains the historical SMS table. `messages` is additive and forward-looking.

## Policy Changes

- `leads`, `notes`, `inventory`, and `activity_log` are now owner-aware.
- `messages`, `notifications`, and `failed_deliveries` have RLS enabled with table-specific policies.
- Manager-only backend policies were extended to owner for:
  - `profiles`
  - `companies`
  - `settings`
  - `templates`
  - `crm_files` delete access
- Admin account management RPCs were extended so owner can use them too.

## Further Deltas Found

- The checked-in migration history under [`supabase/migrations`](/C:/Users/Kalee/OneDrive/Documents/2026%20personal%20projects/claude_agents/dealercrm/supabase/migrations) is incomplete relative to the checked-in root SQL files in [`supabase/`](/C:/Users/Kalee/OneDrive/Documents/2026%20personal%20projects/claude_agents/dealercrm/supabase).
- `appointments` and `tasks` are referenced by existing RLS SQL, but their table definitions are not present in the repo files I inspected.
- `activity_log` previously allowed broad authenticated reads/inserts in the checked-in SQL; this wave tightens it to lead-scoped access through `can_access_lead()`.

## Verification Limits On This Machine

- I could not run `supabase db dump --schema public` here because the Supabase CLI is not installed on this machine.
- I could not run `supabase db reset` locally because Docker is not installed.
- I could not run `supabase db push` against the hosted project because no Supabase CLI/link state or direct database connection credentials were available in this environment.
- The migration SQL was written against the checked-in schema/migration state plus the explicit project constraints you provided, not against a live `information_schema` dump from the hosted database.

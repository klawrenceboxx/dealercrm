-- Forward-looking unified communications table.
-- sms_log remains the historical source; messages is the forward-looking unified table.
-- A follow-up migration may backfill from sms_log.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  content text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  channel text not null check (channel in ('sms', 'email')),
  sender_type text not null check (sender_type in ('ai', 'rep', 'lead', 'system')),
  sender_id uuid references public.profiles(id),
  ai_generated boolean default false,
  twilio_sid text,
  resend_id text,
  opened_at timestamptz,
  delivered_at timestamptz
);

comment on table public.messages is
  'Unified forward-looking message stream. Historical SMS remains in sms_log until backfill.';

create index if not exists messages_lead_created_at_idx
  on public.messages (lead_id, created_at desc);

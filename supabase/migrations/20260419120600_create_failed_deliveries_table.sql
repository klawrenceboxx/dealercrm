-- Records outbound delivery failures for follow-up and audit.

create table if not exists public.failed_deliveries (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  channel text not null check (channel in ('sms', 'email')),
  error_code text,
  error_message text,
  attempted_at timestamptz not null default now()
);

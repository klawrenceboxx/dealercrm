-- Add dealership messaging and SLA configuration.

alter table public.companies
  add column if not exists twilio_number text,
  add column if not exists resend_sender text,
  add column if not exists ai_tone text,
  add column if not exists sla_hours integer default 4;

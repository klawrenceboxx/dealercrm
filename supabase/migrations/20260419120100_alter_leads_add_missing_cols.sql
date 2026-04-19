-- Add missing lead lifecycle columns.

alter table public.leads
  add column if not exists is_hot boolean default false,
  add column if not exists hot_flagged_at timestamptz,
  add column if not exists last_rep_reply_at timestamptz,
  add column if not exists last_lead_reply_at timestamptz,
  add column if not exists lost_reason text;

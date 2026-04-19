-- In-app notification queue.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  lead_id uuid references public.leads(id) on delete cascade,
  type text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_is_read_idx
  on public.notifications (user_id, is_read);

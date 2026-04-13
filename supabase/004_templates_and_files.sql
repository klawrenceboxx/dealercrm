-- DealerCRM - SMS templates + private file storage
-- Run after 002_rls_role_based.sql.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'general'
    check (category in ('general', 'follow_up', 'inspection', 'appointment')),
  body text not null,
  variables text[] not null default array['name', 'vehicle'],
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists templates_name_key on public.templates ((lower(name)));
create index if not exists templates_category_idx on public.templates (category);

drop trigger if exists templates_set_updated_at on public.templates;
create trigger templates_set_updated_at
  before update on public.templates
  for each row execute function public.set_updated_at();

alter table public.templates enable row level security;

drop policy if exists "templates_select" on public.templates;
drop policy if exists "templates_insert" on public.templates;
drop policy if exists "templates_update" on public.templates;
drop policy if exists "templates_delete" on public.templates;

create policy "templates_select" on public.templates
  for select using (auth.role() = 'authenticated');

create policy "templates_insert" on public.templates
  for insert with check (public.user_role() = 'manager');

create policy "templates_update" on public.templates
  for update using (public.user_role() = 'manager');

create policy "templates_delete" on public.templates
  for delete using (public.user_role() = 'manager');

insert into public.templates (name, category, body, variables)
values
  (
    'Fresh lead follow-up',
    'follow_up',
    'Hi {{name}}, thanks for reaching out about the {{vehicle}}. Want me to send you price and availability?',
    array['name', 'vehicle']
  ),
  (
    'Inspection ready',
    'inspection',
    'Hi {{name}}, the inspection report for the {{vehicle}} is ready. I can send it over and book a time for you to see it.',
    array['name', 'vehicle']
  )
on conflict do nothing;

create table if not exists public.crm_files (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('lead', 'team')),
  lead_id uuid references public.leads(id) on delete cascade,
  category text not null default 'attachment'
    check (category in ('attachment', 'inspection_report', 'team')),
  bucket_id text not null default 'crm-files',
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  file_size bigint not null default 0,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint crm_files_scope_check check (
    (scope = 'lead' and lead_id is not null and category in ('attachment', 'inspection_report'))
    or
    (scope = 'team' and lead_id is null and category = 'team')
  )
);

create index if not exists crm_files_scope_idx on public.crm_files (scope, created_at desc);
create index if not exists crm_files_lead_idx on public.crm_files (lead_id, created_at desc);

alter table public.crm_files enable row level security;

drop policy if exists "crm_files_select" on public.crm_files;
drop policy if exists "crm_files_insert" on public.crm_files;
drop policy if exists "crm_files_delete" on public.crm_files;

create policy "crm_files_select" on public.crm_files
  for select using (auth.role() = 'authenticated');

create policy "crm_files_insert" on public.crm_files
  for insert with check (auth.role() = 'authenticated');

create policy "crm_files_delete" on public.crm_files
  for delete using (
    public.user_role() = 'manager'
    or uploaded_by = auth.uid()
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'crm-files',
  'crm-files',
  false,
  20971520,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.crm_file_record_exists(target_bucket text, target_name text)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from public.crm_files
    where bucket_id = target_bucket
      and storage_path = target_name
  )
$$;

drop policy if exists "crm files select" on storage.objects;
drop policy if exists "crm files insert" on storage.objects;
drop policy if exists "crm files delete" on storage.objects;

create policy "crm files select" on storage.objects
  for select using (
    bucket_id = 'crm-files'
    and auth.role() = 'authenticated'
    and public.crm_file_record_exists(bucket_id, name)
  );

create policy "crm files insert" on storage.objects
  for insert with check (
    bucket_id = 'crm-files'
    and auth.role() = 'authenticated'
    and public.crm_file_record_exists(bucket_id, name)
  );

create policy "crm files delete" on storage.objects
  for delete using (
    bucket_id = 'crm-files'
    and auth.role() = 'authenticated'
    and public.crm_file_record_exists(bucket_id, name)
  );

-- DealerCRM - Phase 5: manager backend + rep-scoped RLS
-- Run after 004_templates_and_files.sql.

alter table public.profiles
  add column if not exists phone text,
  add column if not exists active boolean not null default true,
  add column if not exists rr_order integer not null default 0,
  add column if not exists suspended_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_role_check;

update public.profiles
set role = case
  when role = 'sales' then 'rep'
  when role in ('rep', 'manager', 'admin') then role
  else 'rep'
end
where role is distinct from case
  when role = 'sales' then 'rep'
  when role in ('rep', 'manager', 'admin') then role
  else 'rep'
end;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('rep', 'manager', 'admin'));

alter table public.leads
  add column if not exists sold_at timestamptz,
  add column if not exists sold_price numeric(10, 2),
  add column if not exists cost_of_car numeric(10, 2),
  add column if not exists recon_cost numeric(10, 2) not null default 0;

create or replace function public.user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'rep')
$$;

create or replace function public.current_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and suspended_at is null
  )
$$;

create or replace function public.is_manager_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_role() in ('manager', 'admin')
$$;

create or replace function public.can_access_lead(target_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_active()
    and (
      public.is_manager_or_admin()
      or exists (
        select 1
        from public.leads
        where id = target_lead_id
          and assigned_to = auth.uid()
      )
    )
$$;

drop policy if exists "authenticated full access" on public.leads;
drop policy if exists "leads_select" on public.leads;
drop policy if exists "leads_insert" on public.leads;
drop policy if exists "leads_update" on public.leads;
drop policy if exists "leads_delete" on public.leads;

create policy "leads_select" on public.leads
  for select using (
    public.current_user_is_active()
    and (
      public.is_manager_or_admin()
      or assigned_to = auth.uid()
    )
  );

create policy "leads_insert" on public.leads
  for insert with check (
    public.current_user_is_active()
    and (
      public.is_manager_or_admin()
      or coalesce(assigned_to, auth.uid()) = auth.uid()
    )
  );

create policy "leads_update" on public.leads
  for update using (
    public.current_user_is_active()
    and (
      public.is_manager_or_admin()
      or assigned_to = auth.uid()
    )
  )
  with check (
    public.current_user_is_active()
    and (
      public.is_manager_or_admin()
      or assigned_to = auth.uid()
    )
  );

create policy "leads_delete" on public.leads
  for delete using (
    public.current_user_is_active()
    and public.is_manager_or_admin()
  );

drop policy if exists "authenticated full access" on public.sms_log;
drop policy if exists "sms_log_select" on public.sms_log;
drop policy if exists "sms_log_insert" on public.sms_log;
drop policy if exists "sms_log_update" on public.sms_log;

create policy "sms_log_select" on public.sms_log
  for select using (public.can_access_lead(lead_id));

create policy "sms_log_insert" on public.sms_log
  for insert with check (public.can_access_lead(lead_id));

create policy "sms_log_update" on public.sms_log
  for update using (public.can_access_lead(lead_id))
  with check (public.can_access_lead(lead_id));

drop policy if exists "authenticated full access" on public.notes;
drop policy if exists "notes_select" on public.notes;
drop policy if exists "notes_insert" on public.notes;
drop policy if exists "notes_update" on public.notes;
drop policy if exists "notes_delete" on public.notes;

create policy "notes_select" on public.notes
  for select using (public.can_access_lead(lead_id));

create policy "notes_insert" on public.notes
  for insert with check (
    public.can_access_lead(lead_id)
    and created_by = auth.uid()
  );

create policy "notes_update" on public.notes
  for update using (
    public.can_access_lead(lead_id)
    and (public.is_manager_or_admin() or created_by = auth.uid())
  )
  with check (
    public.can_access_lead(lead_id)
    and (public.is_manager_or_admin() or created_by = auth.uid())
  );

create policy "notes_delete" on public.notes
  for delete using (
    public.can_access_lead(lead_id)
    and (public.is_manager_or_admin() or created_by = auth.uid())
  );

drop policy if exists "users can view all profiles" on public.profiles;
drop policy if exists "users can update own profile" on public.profiles;
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_insert" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "profiles_update_manager" on public.profiles;

create policy "profiles_select" on public.profiles
  for select using (
    id = auth.uid()
    or (public.current_user_is_active() and public.is_manager_or_admin())
  );

create policy "profiles_insert" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_manager" on public.profiles
  for update using (
    public.current_user_is_active()
    and public.is_manager_or_admin()
  )
  with check (
    public.current_user_is_active()
    and public.is_manager_or_admin()
  );

drop policy if exists "inventory_select" on public.inventory;
drop policy if exists "inventory_insert" on public.inventory;
drop policy if exists "inventory_update" on public.inventory;
drop policy if exists "inventory_delete" on public.inventory;

create policy "inventory_select" on public.inventory
  for select using (public.current_user_is_active());

create policy "inventory_insert" on public.inventory
  for insert with check (
    public.current_user_is_active()
    and public.is_manager_or_admin()
  );

create policy "inventory_update" on public.inventory
  for update using (
    public.current_user_is_active()
    and public.is_manager_or_admin()
  )
  with check (
    public.current_user_is_active()
    and public.is_manager_or_admin()
  );

create policy "inventory_delete" on public.inventory
  for delete using (
    public.current_user_is_active()
    and public.is_manager_or_admin()
  );

alter table public.leads
  drop constraint if exists leads_assigned_to_fkey;
alter table public.leads
  add constraint leads_assigned_to_fkey
  foreign key (assigned_to)
  references public.profiles(id)
  on delete set null;

alter table public.notes
  drop constraint if exists notes_created_by_fkey;
alter table public.notes
  add constraint notes_created_by_fkey
  foreign key (created_by)
  references public.profiles(id)
  on delete set null;

alter table public.inventory
  drop constraint if exists inventory_added_by_fkey;
alter table public.inventory
  add constraint inventory_added_by_fkey
  foreign key (added_by)
  references public.profiles(id)
  on delete set null;

alter table public.templates
  drop constraint if exists templates_created_by_fkey;
alter table public.templates
  add constraint templates_created_by_fkey
  foreign key (created_by)
  references public.profiles(id)
  on delete set null;

alter table public.templates
  drop constraint if exists templates_updated_by_fkey;
alter table public.templates
  add constraint templates_updated_by_fkey
  foreign key (updated_by)
  references public.profiles(id)
  on delete set null;

alter table public.crm_files
  drop constraint if exists crm_files_uploaded_by_fkey;
alter table public.crm_files
  add constraint crm_files_uploaded_by_fkey
  foreign key (uploaded_by)
  references public.profiles(id)
  on delete set null;

create or replace function public.admin_set_user_suspension(target_user_id uuid, should_suspend boolean)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  updated_profile public.profiles;
begin
  if not public.current_user_is_active() or not public.is_manager_or_admin() then
    raise exception 'Not authorized';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'You cannot suspend your own account';
  end if;

  update public.profiles
  set suspended_at = case when should_suspend then now() else null end,
      active = case when should_suspend then false else active end
  where id = target_user_id
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'Profile not found';
  end if;

  update auth.users
  set banned_until = case when should_suspend then now() + interval '100 years' else null end
  where id = target_user_id;

  return updated_profile;
end;
$$;

create or replace function public.admin_delete_user_account(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.current_user_is_active() or not public.is_manager_or_admin() then
    raise exception 'Not authorized';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'You cannot delete your own account';
  end if;

  delete from auth.users
  where id = target_user_id;

  if not found then
    raise exception 'User not found';
  end if;
end;
$$;

grant execute on function public.admin_set_user_suspension(uuid, boolean) to authenticated;
grant execute on function public.admin_delete_user_account(uuid) to authenticated;

-- Extend existing RLS helpers and apply owner-aware policies to current and new tables.

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_role() = 'owner'
$$;

create or replace function public.is_manager_admin_or_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_role() in ('manager', 'admin', 'owner')
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
      public.is_manager_admin_or_owner()
      or exists (
        select 1
        from public.leads
        where id = target_lead_id
          and assigned_to = auth.uid()
      )
    )
$$;

create or replace function public.admin_set_user_suspension(target_user_id uuid, should_suspend boolean)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  updated_profile public.profiles;
begin
  if not public.current_user_is_active() or not public.is_manager_admin_or_owner() then
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
  if not public.current_user_is_active() or not public.is_manager_admin_or_owner() then
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

alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.failed_deliveries enable row level security;

drop policy if exists "leads_select" on public.leads;
drop policy if exists "leads_insert" on public.leads;
drop policy if exists "leads_update" on public.leads;
drop policy if exists "leads_delete" on public.leads;

create policy "leads_select" on public.leads
  for select using (
    public.current_user_is_active()
    and (
      public.is_manager_admin_or_owner()
      or assigned_to = auth.uid()
    )
  );

create policy "leads_insert" on public.leads
  for insert with check (
    public.current_user_is_active()
    and (
      public.is_manager_admin_or_owner()
      or coalesce(assigned_to, auth.uid()) = auth.uid()
    )
  );

create policy "leads_update" on public.leads
  for update using (
    public.current_user_is_active()
    and (
      public.is_manager_admin_or_owner()
      or assigned_to = auth.uid()
    )
  )
  with check (
    public.current_user_is_active()
    and (
      public.is_manager_admin_or_owner()
      or assigned_to = auth.uid()
    )
  );

create policy "leads_delete" on public.leads
  for delete using (
    public.current_user_is_active()
    and public.is_manager_admin_or_owner()
  );

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
    and (public.is_manager_admin_or_owner() or created_by = auth.uid())
  )
  with check (
    public.can_access_lead(lead_id)
    and (public.is_manager_admin_or_owner() or created_by = auth.uid())
  );

create policy "notes_delete" on public.notes
  for delete using (
    public.can_access_lead(lead_id)
    and (public.is_manager_admin_or_owner() or created_by = auth.uid())
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
    and public.is_manager_admin_or_owner()
  );

create policy "inventory_update" on public.inventory
  for update using (
    public.current_user_is_active()
    and public.is_manager_admin_or_owner()
  )
  with check (
    public.current_user_is_active()
    and public.is_manager_admin_or_owner()
  );

create policy "inventory_delete" on public.inventory
  for delete using (
    public.current_user_is_active()
    and public.is_manager_admin_or_owner()
  );

drop policy if exists "activity_log_select" on public.activity_log;
drop policy if exists "activity_log_insert" on public.activity_log;

create policy "activity_log_select" on public.activity_log
  for select using (public.can_access_lead(lead_id));

create policy "activity_log_insert" on public.activity_log
  for insert with check (
    public.current_user_is_active()
    and public.can_access_lead(lead_id)
  );

drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_insert" on public.profiles;
drop policy if exists "profiles_update_manager" on public.profiles;

create policy "profiles_select" on public.profiles
  for select using (
    id = auth.uid()
    or (public.current_user_is_active() and public.is_manager_admin_or_owner())
  );

create policy "profiles_insert" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_manager" on public.profiles
  for update using (
    public.current_user_is_active()
    and public.is_manager_admin_or_owner()
  )
  with check (
    public.current_user_is_active()
    and public.is_manager_admin_or_owner()
  );

drop policy if exists "companies_select" on public.companies;
drop policy if exists "companies_insert" on public.companies;
drop policy if exists "companies_update" on public.companies;

create policy "companies_select" on public.companies
  for select using (public.current_user_is_active());

create policy "companies_insert" on public.companies
  for insert with check (
    public.current_user_is_active()
    and public.is_manager_admin_or_owner()
  );

create policy "companies_update" on public.companies
  for update using (
    public.current_user_is_active()
    and public.is_manager_admin_or_owner()
  )
  with check (
    public.current_user_is_active()
    and public.is_manager_admin_or_owner()
  );

drop policy if exists "settings_select" on public.settings;
drop policy if exists "settings_insert" on public.settings;
drop policy if exists "settings_update" on public.settings;

create policy "settings_select" on public.settings
  for select using (public.current_user_is_active());

create policy "settings_insert" on public.settings
  for insert with check (
    public.current_user_is_active()
    and public.is_manager_admin_or_owner()
  );

create policy "settings_update" on public.settings
  for update using (
    public.current_user_is_active()
    and public.is_manager_admin_or_owner()
  )
  with check (
    public.current_user_is_active()
    and public.is_manager_admin_or_owner()
  );

drop policy if exists "templates_select" on public.templates;
drop policy if exists "templates_insert" on public.templates;
drop policy if exists "templates_update" on public.templates;
drop policy if exists "templates_delete" on public.templates;

create policy "templates_select" on public.templates
  for select using (public.current_user_is_active());

create policy "templates_insert" on public.templates
  for insert with check (
    public.current_user_is_active()
    and public.is_manager_admin_or_owner()
  );

create policy "templates_update" on public.templates
  for update using (
    public.current_user_is_active()
    and public.is_manager_admin_or_owner()
  )
  with check (
    public.current_user_is_active()
    and public.is_manager_admin_or_owner()
  );

create policy "templates_delete" on public.templates
  for delete using (
    public.current_user_is_active()
    and public.is_manager_admin_or_owner()
  );

drop policy if exists "crm_files_delete" on public.crm_files;

create policy "crm_files_delete" on public.crm_files
  for delete using (
    public.current_user_is_active()
    and (
      public.is_manager_admin_or_owner()
      or uploaded_by = auth.uid()
    )
  );

drop policy if exists "messages_select" on public.messages;
drop policy if exists "messages_insert" on public.messages;

create policy "messages_select" on public.messages
  for select using (public.can_access_lead(lead_id));

create policy "messages_insert" on public.messages
  for insert with check (
    public.can_access_lead(lead_id)
    and (sender_type <> 'rep' or sender_id = auth.uid())
  );

drop policy if exists "notifications_select" on public.notifications;
drop policy if exists "notifications_update" on public.notifications;
drop policy if exists "notifications_insert" on public.notifications;

create policy "notifications_select" on public.notifications
  for select using (user_id = auth.uid());

create policy "notifications_update" on public.notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notifications_insert" on public.notifications
  for insert with check (auth.role() = 'service_role');

drop policy if exists "failed_deliveries_select" on public.failed_deliveries;

create policy "failed_deliveries_select" on public.failed_deliveries
  for select using (public.is_manager_admin_or_owner());

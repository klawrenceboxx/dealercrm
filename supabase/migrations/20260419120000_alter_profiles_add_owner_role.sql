-- Add owner to the profiles role constraint.

alter table public.profiles
  drop constraint if exists profiles_role_check;

update public.profiles
set role = case
  when role = 'sales' then 'rep'
  when role in ('rep', 'manager', 'admin', 'owner') then role
  else 'rep'
end
where role is distinct from case
  when role = 'sales' then 'rep'
  when role in ('rep', 'manager', 'admin', 'owner') then role
  else 'rep'
end;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('rep', 'manager', 'admin', 'owner'));

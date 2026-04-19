-- Migration 004: Unified event logging + rep performance reporting
-- Adds normalized activity columns, auto-log triggers, and reporting RPCs.

alter table public.activity_log
  add column if not exists actor_id uuid references public.profiles(id) on delete set null,
  add column if not exists resend_message_id text,
  add column if not exists external_event_id text;

create index if not exists activity_log_actor_id_idx
  on public.activity_log (actor_id, created_at desc);

create index if not exists activity_log_resend_message_id_idx
  on public.activity_log (resend_message_id);

create unique index if not exists activity_log_external_event_id_uidx
  on public.activity_log (external_event_id)
  where external_event_id is not null;

create or replace function public.log_lead_event(
  p_lead_id uuid,
  p_event_type text,
  p_metadata jsonb default '{}'::jsonb,
  p_actor_id uuid default auth.uid(),
  p_created_at timestamptz default now(),
  p_resend_message_id text default null,
  p_external_event_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_event_id uuid;
begin
  select company_id
  into v_company_id
  from public.leads
  where id = p_lead_id;

  insert into public.activity_log (
    lead_id,
    company_id,
    actor_id,
    event_type,
    metadata,
    resend_message_id,
    external_event_id,
    created_at
  )
  values (
    p_lead_id,
    v_company_id,
    p_actor_id,
    p_event_type,
    coalesce(p_metadata, '{}'::jsonb),
    p_resend_message_id,
    p_external_event_id,
    coalesce(p_created_at, now())
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

create or replace function public.handle_lead_activity_events()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.assigned_to is not null then
      perform public.log_lead_event(
        new.id,
        'lead_assigned',
        jsonb_strip_nulls(jsonb_build_object(
          'source', 'lead_insert',
          'assigned_by', auth.uid()
        )),
        new.assigned_to,
        coalesce(new.created_at, now())
      );
    end if;

    if new.stage = 'closed' then
      perform public.log_lead_event(
        new.id,
        'deal_closed',
        jsonb_strip_nulls(jsonb_build_object(
          'previous_stage', null,
          'closed_by', auth.uid()
        )),
        new.assigned_to,
        now()
      );
    end if;

    return new;
  end if;

  if new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null then
    perform public.log_lead_event(
      new.id,
      'lead_assigned',
      jsonb_strip_nulls(jsonb_build_object(
        'source', 'lead_update',
        'previous_assigned_to', old.assigned_to,
        'assigned_by', auth.uid()
      )),
      new.assigned_to,
      now()
    );
  end if;

  if new.stage is distinct from old.stage and new.stage = 'closed' then
    perform public.log_lead_event(
      new.id,
      'deal_closed',
      jsonb_strip_nulls(jsonb_build_object(
        'previous_stage', old.stage,
        'closed_by', auth.uid()
      )),
      coalesce(new.assigned_to, old.assigned_to),
      now()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_leads_activity_events on public.leads;
create trigger trg_leads_activity_events
  after insert or update on public.leads
  for each row execute function public.handle_lead_activity_events();

create or replace function public.handle_note_activity_events()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.created_by is not null then
    perform public.log_lead_event(
      new.lead_id,
      'rep_response',
      jsonb_strip_nulls(jsonb_build_object(
        'channel', 'note',
        'note_excerpt', left(trim(new.content), 160)
      )),
      new.created_by,
      coalesce(new.created_at, now())
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notes_activity_events on public.notes;
create trigger trg_notes_activity_events
  after insert on public.notes
  for each row execute function public.handle_note_activity_events();

create or replace function public.handle_sms_activity_events()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_assigned_to uuid;
begin
  if new.direction <> 'outbound' then
    return new;
  end if;

  select assigned_to
  into v_assigned_to
  from public.leads
  where id = new.lead_id;

  perform public.log_lead_event(
    new.lead_id,
    'sms_sent',
    jsonb_strip_nulls(jsonb_build_object(
      'direction', new.direction,
      'trigger_type', new.trigger_type,
      'intent_score', new.intent_score,
      'demo', new.demo,
      'body_excerpt', left(trim(new.body), 160)
    )),
    v_assigned_to,
    coalesce(new.sent_at, now())
  );

  return new;
end;
$$;

drop trigger if exists trg_sms_activity_events on public.sms_log;
create trigger trg_sms_activity_events
  after insert on public.sms_log
  for each row execute function public.handle_sms_activity_events();

create or replace function public.rep_daily_metrics(p_days integer default 30)
returns table (
  metric_date date,
  rep_id uuid,
  rep_name text,
  leads_assigned bigint,
  responses bigint,
  deals_closed bigint
)
language sql
stable
set search_path = public
as $$
  with bounds as (
    select
      (current_date - (greatest(coalesce(p_days, 30), 1) - 1))::date as start_date,
      current_date::date as end_date
  ),
  days as (
    select generate_series(
      (select start_date from bounds),
      (select end_date from bounds),
      interval '1 day'
    )::date as metric_date
  ),
  reps as (
    select
      p.id as rep_id,
      coalesce(nullif(trim(p.full_name), ''), split_part(p.id::text, '-', 1)) as rep_name
    from public.profiles p
  ),
  assignment_counts as (
    select
      a.created_at::date as metric_date,
      a.actor_id as rep_id,
      count(*)::bigint as total
    from public.activity_log a
    cross join bounds b
    where a.event_type = 'lead_assigned'
      and a.actor_id is not null
      and a.created_at >= b.start_date
      and a.created_at < (b.end_date + 1)
    group by 1, 2
  ),
  response_counts as (
    select
      a.created_at::date as metric_date,
      a.actor_id as rep_id,
      count(*)::bigint as total
    from public.activity_log a
    cross join bounds b
    where a.event_type = 'rep_response'
      and a.actor_id is not null
      and a.created_at >= b.start_date
      and a.created_at < (b.end_date + 1)
    group by 1, 2
  ),
  deal_counts as (
    select
      a.created_at::date as metric_date,
      a.actor_id as rep_id,
      count(*)::bigint as total
    from public.activity_log a
    cross join bounds b
    where a.event_type = 'deal_closed'
      and a.actor_id is not null
      and a.created_at >= b.start_date
      and a.created_at < (b.end_date + 1)
    group by 1, 2
  )
  select
    d.metric_date,
    r.rep_id,
    r.rep_name,
    coalesce(ac.total, 0) as leads_assigned,
    coalesce(rc.total, 0) as responses,
    coalesce(dc.total, 0) as deals_closed
  from days d
  cross join reps r
  left join assignment_counts ac
    on ac.metric_date = d.metric_date and ac.rep_id = r.rep_id
  left join response_counts rc
    on rc.metric_date = d.metric_date and rc.rep_id = r.rep_id
  left join deal_counts dc
    on dc.metric_date = d.metric_date and dc.rep_id = r.rep_id
  order by d.metric_date asc, r.rep_name asc;
$$;

create or replace function public.rep_kpi_metrics(p_days integer default 30)
returns table (
  rep_id uuid,
  rep_name text,
  assigned_leads bigint,
  responded_leads bigint,
  deals_closed bigint,
  response_rate numeric,
  avg_response_minutes numeric
)
language sql
stable
set search_path = public
as $$
  with bounds as (
    select
      (current_date - (greatest(coalesce(p_days, 30), 1) - 1))::timestamptz as start_at,
      (current_date + 1)::timestamptz as end_at
  ),
  reps as (
    select
      p.id as rep_id,
      coalesce(nullif(trim(p.full_name), ''), split_part(p.id::text, '-', 1)) as rep_name
    from public.profiles p
  ),
  assignments as (
    select
      a.lead_id,
      a.actor_id as rep_id,
      a.created_at as assigned_at,
      lead(a.created_at) over (partition by a.lead_id order by a.created_at) as next_assignment_at
    from public.activity_log a
    cross join bounds b
    where a.event_type = 'lead_assigned'
      and a.actor_id is not null
      and a.created_at >= b.start_at
      and a.created_at < b.end_at
  ),
  first_responses as (
    select
      a.lead_id,
      a.rep_id,
      a.assigned_at,
      min(r.created_at) as responded_at
    from assignments a
    left join public.activity_log r
      on r.lead_id = a.lead_id
      and r.event_type = 'rep_response'
      and r.actor_id = a.rep_id
      and r.created_at >= a.assigned_at
      and (a.next_assignment_at is null or r.created_at < a.next_assignment_at)
    group by a.lead_id, a.rep_id, a.assigned_at
  ),
  assignment_rollup as (
    select
      fr.rep_id,
      count(*)::bigint as assigned_leads,
      count(*) filter (where fr.responded_at is not null)::bigint as responded_leads,
      avg(extract(epoch from (fr.responded_at - fr.assigned_at)) / 60.0)
        filter (where fr.responded_at is not null) as avg_response_minutes
    from first_responses fr
    group by fr.rep_id
  ),
  deal_rollup as (
    select
      a.actor_id as rep_id,
      count(*)::bigint as deals_closed
    from public.activity_log a
    cross join bounds b
    where a.event_type = 'deal_closed'
      and a.actor_id is not null
      and a.created_at >= b.start_at
      and a.created_at < b.end_at
    group by a.actor_id
  )
  select
    r.rep_id,
    r.rep_name,
    coalesce(ar.assigned_leads, 0) as assigned_leads,
    coalesce(ar.responded_leads, 0) as responded_leads,
    coalesce(dr.deals_closed, 0) as deals_closed,
    case
      when coalesce(ar.assigned_leads, 0) = 0 then 0
      else round((ar.responded_leads::numeric / ar.assigned_leads::numeric) * 100, 1)
    end as response_rate,
    round(coalesce(ar.avg_response_minutes, 0)::numeric, 1) as avg_response_minutes
  from reps r
  left join assignment_rollup ar on ar.rep_id = r.rep_id
  left join deal_rollup dr on dr.rep_id = r.rep_id
  order by r.rep_name asc;
$$;

-- DO NOT RUN IN PRODUCTION
-- Local/staging seed data for DealerCRM.

do $$
declare
  v_company_id uuid;
begin
  insert into public.companies (
    name,
    slug,
    domain,
    twilio_number,
    resend_sender,
    ai_tone,
    sla_hours
  )
  values (
    'Style Auto',
    'style-auto',
    'styleauto.ca',
    '+15145550100',
    'Style Auto <sales@styleauto.ca>',
    'Helpful, direct, dealership-floor practical',
    4
  )
  on conflict (slug) do update
  set name = excluded.name,
      domain = excluded.domain,
      twilio_number = excluded.twilio_number,
      resend_sender = excluded.resend_sender,
      ai_tone = excluded.ai_tone,
      sla_hours = excluded.sla_hours;

  select id
  into v_company_id
  from public.companies
  where slug = 'style-auto';

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values
    (
      '00000000-0000-0000-0000-000000000000',
      '11111111-1111-1111-1111-111111111111',
      'authenticated',
      'authenticated',
      'rep@dealercrm.local',
      crypt('password123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Rep Demo"}'::jsonb,
      now(),
      now()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      '22222222-2222-2222-2222-222222222222',
      'authenticated',
      'authenticated',
      'manager@dealercrm.local',
      crypt('password123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Manager Demo"}'::jsonb,
      now(),
      now()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      '33333333-3333-3333-3333-333333333333',
      'authenticated',
      'authenticated',
      'admin@dealercrm.local',
      crypt('password123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Admin Demo"}'::jsonb,
      now(),
      now()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      '44444444-4444-4444-4444-444444444444',
      'authenticated',
      'authenticated',
      'owner@dealercrm.local',
      crypt('password123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Owner Demo"}'::jsonb,
      now(),
      now()
    )
  on conflict (id) do update
  set email = excluded.email,
      raw_user_meta_data = excluded.raw_user_meta_data,
      updated_at = now();

  insert into auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values
    (
      '11111111-1111-1111-1111-111111111111',
      '11111111-1111-1111-1111-111111111111',
      'rep@dealercrm.local',
      '{"sub":"11111111-1111-1111-1111-111111111111","email":"rep@dealercrm.local"}'::jsonb,
      'email',
      now(),
      now(),
      now()
    ),
    (
      '22222222-2222-2222-2222-222222222222',
      '22222222-2222-2222-2222-222222222222',
      'manager@dealercrm.local',
      '{"sub":"22222222-2222-2222-2222-222222222222","email":"manager@dealercrm.local"}'::jsonb,
      'email',
      now(),
      now(),
      now()
    ),
    (
      '33333333-3333-3333-3333-333333333333',
      '33333333-3333-3333-3333-333333333333',
      'admin@dealercrm.local',
      '{"sub":"33333333-3333-3333-3333-333333333333","email":"admin@dealercrm.local"}'::jsonb,
      'email',
      now(),
      now(),
      now()
    ),
    (
      '44444444-4444-4444-4444-444444444444',
      '44444444-4444-4444-4444-444444444444',
      'owner@dealercrm.local',
      '{"sub":"44444444-4444-4444-4444-444444444444","email":"owner@dealercrm.local"}'::jsonb,
      'email',
      now(),
      now(),
      now()
    )
  on conflict (id) do update
  set user_id = excluded.user_id,
      provider_id = excluded.provider_id,
      provider = excluded.provider,
      identity_data = excluded.identity_data,
      updated_at = now();

  insert into public.profiles (
    id,
    name,
    full_name,
    phone,
    role,
    active,
    rr_order
  )
  values
    ('11111111-1111-1111-1111-111111111111', 'Rep Demo', 'Rep Demo', '+15145550101', 'rep', true, 1),
    ('22222222-2222-2222-2222-222222222222', 'Manager Demo', 'Manager Demo', '+15145550102', 'manager', true, 2),
    ('33333333-3333-3333-3333-333333333333', 'Admin Demo', 'Admin Demo', '+15145550103', 'admin', true, 3),
    ('44444444-4444-4444-4444-444444444444', 'Owner Demo', 'Owner Demo', '+15145550104', 'owner', true, 4)
  on conflict (id) do update
  set name = excluded.name,
      full_name = excluded.full_name,
      phone = excluded.phone,
      role = excluded.role,
      active = excluded.active,
      rr_order = excluded.rr_order,
      suspended_at = null;

  insert into public.inventory (
    vin,
    year,
    make,
    model,
    trim,
    color,
    mileage_km,
    price,
    status,
    stock_number,
    image_urls,
    added_by
  )
  values
    ('2HGFC2F59JH000001', 2021, 'Honda', 'Civic', 'Sport', 'Black', 54200, 21995, 'available', 'SA-1001', array['https://images.example.com/civic-1.jpg'], '22222222-2222-2222-2222-222222222222'),
    ('1HGCV1F38MA000002', 2022, 'Honda', 'Accord', 'EX-L', 'White', 38800, 28750, 'available', 'SA-1002', array['https://images.example.com/accord-1.jpg'], '22222222-2222-2222-2222-222222222222'),
    ('3VW2B7AJ5HM000003', 2020, 'Volkswagen', 'Jetta', 'Highline', 'Grey', 61100, 18495, 'available', 'SA-1003', array['https://images.example.com/jetta-1.jpg'], '22222222-2222-2222-2222-222222222222'),
    ('1FMCU9G69NU000004', 2023, 'Ford', 'Escape', 'ST-Line', 'Blue', 21400, 32900, 'available', 'SA-1004', array['https://images.example.com/escape-1.jpg'], '22222222-2222-2222-2222-222222222222'),
    ('KM8K2CAB8PU000005', 2023, 'Hyundai', 'Kona', 'Preferred', 'Red', 16750, 27600, 'available', 'SA-1005', array['https://images.example.com/kona-1.jpg'], '22222222-2222-2222-2222-222222222222')
  on conflict (vin) do update
  set year = excluded.year,
      make = excluded.make,
      model = excluded.model,
      trim = excluded.trim,
      color = excluded.color,
      mileage_km = excluded.mileage_km,
      price = excluded.price,
      status = excluded.status,
      stock_number = excluded.stock_number,
      image_urls = excluded.image_urls,
      added_by = excluded.added_by,
      updated_at = now();

  insert into public.leads (
    id,
    lead_id,
    company_id,
    first_name,
    last_name,
    phone,
    email,
    source,
    vehicle_interest,
    stage,
    intent_score,
    assigned_to,
    assigned_at,
    is_hot,
    hot_flagged_at,
    last_rep_reply_at,
    last_lead_reply_at,
    created_at
  )
  values
    (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
      'seed-lead-001',
      v_company_id,
      'Marc',
      'Tremblay',
      '+15145550111',
      'marc.tremblay@example.com',
      'website_form',
      '2023 Ford Escape ST-Line',
      'new',
      'warm',
      '11111111-1111-1111-1111-111111111111',
      now() - interval '2 days',
      false,
      null,
      now() - interval '1 day',
      now() - interval '20 hours',
      now() - interval '2 days'
    ),
    (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
      'seed-lead-002',
      v_company_id,
      'Sophie',
      'Gagnon',
      '+15145550112',
      'sophie.gagnon@example.com',
      'website',
      '2022 Honda Accord EX-L',
      'contacted',
      'hot',
      '11111111-1111-1111-1111-111111111111',
      now() - interval '4 days',
      true,
      now() - interval '3 days',
      now() - interval '12 hours',
      now() - interval '10 hours',
      now() - interval '4 days'
    ),
    (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
      'seed-lead-003',
      v_company_id,
      'Olivier',
      'Roy',
      '+15145550113',
      'olivier.roy@example.com',
      'meta',
      '2021 Honda Civic Sport',
      'warm',
      'warm',
      '11111111-1111-1111-1111-111111111111',
      now() - interval '6 days',
      false,
      null,
      now() - interval '2 days',
      now() - interval '36 hours',
      now() - interval '6 days'
    )
  on conflict (id) do update
  set lead_id = excluded.lead_id,
      company_id = excluded.company_id,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      phone = excluded.phone,
      email = excluded.email,
      source = excluded.source,
      vehicle_interest = excluded.vehicle_interest,
      stage = excluded.stage,
      intent_score = excluded.intent_score,
      assigned_to = excluded.assigned_to,
      assigned_at = excluded.assigned_at,
      is_hot = excluded.is_hot,
      hot_flagged_at = excluded.hot_flagged_at,
      last_rep_reply_at = excluded.last_rep_reply_at,
      last_lead_reply_at = excluded.last_lead_reply_at;
end
$$;

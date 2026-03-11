create extension if not exists btree_gist;
create extension if not exists cube;
create extension if not exists earthdistance;

create table if not exists users (
  id bigserial primary key,
  display_name text not null,
  timezone text not null,
  default_capacity int not null check (default_capacity > 0),
  booking_horizon_days int not null default 60 check (booking_horizon_days > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists services (
  id bigserial primary key,
  provider_user_id bigint not null references users(id) on delete cascade,
  name text not null,
  duration_minutes int not null check (duration_minutes > 0 and duration_minutes % 30 = 0),
  capacity_override int check (capacity_override > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_provider_user_id_id_unique unique (provider_user_id, id)
);

create table if not exists weekly_availability_rules (
  id bigserial primary key,
  provider_user_id bigint not null references users(id) on delete cascade,
  service_id bigint,
  weekday smallint not null check (weekday between 0 and 6),
  start_local time not null,
  end_local time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_availability_rules_time_order check (start_local < end_local),
  constraint weekly_availability_rules_slot_alignment check (
    extract(minute from start_local) in (0, 30)
    and extract(minute from end_local) in (0, 30)
    and extract(second from start_local) = 0
    and extract(second from end_local) = 0
    and start_local = date_trunc('second', start_local)
    and end_local = date_trunc('second', end_local)
  ),
  constraint weekly_availability_rules_provider_service_fk foreign key (provider_user_id, service_id)
    references services(provider_user_id, id) on delete cascade
);

create table if not exists availability_windows (
  id bigserial primary key,
  provider_user_id bigint not null references users(id) on delete cascade,
  service_id bigint,
  slot tstzrange not null,
  source text not null check (source in ('generated', 'manual')),
  rule_id bigint references weekly_availability_rules(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_windows_slot_valid check (
    lower(slot) < upper(slot)
    and lower_inc(slot)
    and not upper_inc(slot)
    and extract(minute from lower(slot)) in (0, 30)
    and extract(minute from upper(slot)) in (0, 30)
    and extract(second from lower(slot)) = 0
    and extract(second from upper(slot)) = 0
    and lower(slot) = date_trunc('second', lower(slot))
    and upper(slot) = date_trunc('second', upper(slot))
  ),
  constraint availability_windows_no_overlap exclude using gist (
    provider_user_id with =,
    coalesce(service_id, 0) with =,
    slot with &&
  ),
  constraint availability_windows_provider_service_fk foreign key (provider_user_id, service_id)
    references services(provider_user_id, id) on delete cascade
);

create table if not exists availability_blocks (
  id bigserial primary key,
  provider_user_id bigint not null references users(id) on delete cascade,
  service_id bigint,
  slot tstzrange not null,
  reason text,
  source text not null check (source in ('manual', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_blocks_slot_valid check (
    lower(slot) < upper(slot)
    and lower_inc(slot)
    and not upper_inc(slot)
    and extract(minute from lower(slot)) in (0, 30)
    and extract(minute from upper(slot)) in (0, 30)
    and extract(second from lower(slot)) = 0
    and extract(second from upper(slot)) = 0
    and lower(slot) = date_trunc('second', lower(slot))
    and upper(slot) = date_trunc('second', upper(slot))
  ),
  constraint availability_blocks_no_overlap exclude using gist (
    provider_user_id with =,
    coalesce(service_id, 0) with =,
    slot with &&
  ),
  constraint availability_blocks_provider_service_fk foreign key (provider_user_id, service_id)
    references services(provider_user_id, id) on delete cascade
);

create table if not exists bookings (
  id bigserial primary key,
  provider_user_id bigint not null references users(id) on delete cascade,
  service_id bigint not null,
  status text not null check (status in ('pending', 'confirmed', 'cancelled', 'no_show')),
  slot tstzrange not null,
  duration interval generated always as (upper(slot) - lower(slot)) stored,
  customer_name text not null,
  customer_phone text,
  customer_email text,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_slot_valid check (
    lower(slot) < upper(slot)
    and lower_inc(slot)
    and not upper_inc(slot)
    and extract(minute from lower(slot)) in (0, 30)
    and extract(minute from upper(slot)) in (0, 30)
    and extract(second from lower(slot)) = 0
    and extract(second from upper(slot)) = 0
    and lower(slot) = date_trunc('second', lower(slot))
    and upper(slot) = date_trunc('second', upper(slot))
  ),
  constraint bookings_provider_service_fk foreign key (provider_user_id, service_id)
    references services(provider_user_id, id) on delete cascade
);

create or replace function materialize_availability_windows(
  p_start_date date,
  p_end_date date
) returns void
language plpgsql
as $$
begin
  if p_start_date is null or p_end_date is null then
    raise exception 'start and end dates are required';
  end if;

  if p_start_date >= p_end_date then
    raise exception 'start date must be before end date';
  end if;

  delete from availability_windows aw
  using users u
  where aw.provider_user_id = u.id
    and aw.source = 'generated'
    and (lower(aw.slot) at time zone u.timezone)::date >= p_start_date
    and (lower(aw.slot) at time zone u.timezone)::date < p_end_date;

  insert into availability_windows (
    provider_user_id,
    service_id,
    slot,
    source,
    rule_id
  )
  select
    r.provider_user_id,
    r.service_id,
    tstzrange(
      ((d.day::date)::timestamp + r.start_local) at time zone u.timezone,
      ((d.day::date)::timestamp + r.end_local) at time zone u.timezone,
      '[)'
    ),
    'generated',
    r.id
  from weekly_availability_rules r
  join users u on u.id = r.provider_user_id
  join generate_series(p_start_date, p_end_date - 1, interval '1 day') as d(day)
    on extract(dow from d.day)::int = r.weekday
  where r.is_active;
end;
$$;

create or replace function create_booking(
  p_provider_user_id bigint,
  p_service_id bigint,
  p_customer_name text,
  p_slot tstzrange,
  p_status text default 'pending'
) returns bigint
language plpgsql
as $$
declare
  v_booking_horizon_days int;
  v_default_capacity int;
  v_service_capacity_override int;
  v_service_is_active boolean;
  v_provider_confirmed_overlaps int;
  v_service_confirmed_overlaps int;
  v_booking_id bigint;
begin
  select s.capacity_override, s.is_active
  into v_service_capacity_override, v_service_is_active
  from services s
  where s.id = p_service_id
    and s.provider_user_id = p_provider_user_id;

  if not found then
    raise exception 'service does not exist for provider';
  end if;

  if not v_service_is_active then
    raise exception 'service is inactive';
  end if;

  select u.booking_horizon_days, u.default_capacity
  into v_booking_horizon_days, v_default_capacity
  from users u
  where u.id = p_provider_user_id
  for update;

  if v_booking_horizon_days is null then
    v_booking_horizon_days := 60;
  end if;

  if lower(p_slot) >= now() + make_interval(days => v_booking_horizon_days) then
    raise exception 'booking slot is outside provider booking horizon';
  end if;

  if not exists (
    select 1
    from availability_windows aw
    where aw.provider_user_id = p_provider_user_id
      and (aw.service_id is null or aw.service_id = p_service_id)
      and aw.slot @> p_slot
  ) then
    raise exception 'booking slot is not covered by availability window';
  end if;

  if exists (
    select 1
    from availability_blocks ab
    where ab.provider_user_id = p_provider_user_id
      and (ab.service_id is null or ab.service_id = p_service_id)
      and ab.slot && p_slot
  ) then
    raise exception 'booking slot overlaps an availability block';
  end if;

  if p_status = 'confirmed' then
    select count(*)
    into v_provider_confirmed_overlaps
    from bookings b
    where b.provider_user_id = p_provider_user_id
      and b.status = 'confirmed'
      and b.slot && p_slot;

    if v_provider_confirmed_overlaps >= v_default_capacity then
      raise exception 'booking exceeds provider confirmed capacity';
    end if;

    if v_service_capacity_override is not null then
      select count(*)
      into v_service_confirmed_overlaps
      from bookings b
      where b.provider_user_id = p_provider_user_id
        and b.service_id = p_service_id
        and b.status = 'confirmed'
        and b.slot && p_slot;

      if v_service_confirmed_overlaps >= v_service_capacity_override then
        raise exception 'booking exceeds service confirmed capacity';
      end if;
    end if;
  end if;

  insert into bookings (
    provider_user_id,
    service_id,
    status,
    slot,
    customer_name
  ) values (
    p_provider_user_id,
    p_service_id,
    p_status,
    p_slot,
    p_customer_name
  )
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;

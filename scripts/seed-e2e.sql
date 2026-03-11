truncate table bookings, services, users restart identity cascade;

insert into users (display_name, timezone, default_capacity, booking_horizon_days)
values ('E2E Provider', 'UTC', 2, 60);

insert into services (provider_user_id, name, duration_minutes, is_active)
values
  (1, 'Haircut', 30, true),
  (1, 'Consultation', 60, true);

insert into bookings (provider_user_id, service_id, status, slot, customer_name)
values
  (
    1,
    1,
    'confirmed',
    tstzrange(
      date_trunc('week', now()) + interval '1 day 09:00',
      date_trunc('week', now()) + interval '1 day 09:30',
      '[)'
    ),
    'Alice Johnson'
  ),
  (
    1,
    1,
    'pending',
    tstzrange(
      date_trunc('week', now()) + interval '2 day 13:00',
      date_trunc('week', now()) + interval '2 day 14:00',
      '[)'
    ),
    'Ben Carter'
  ),
  (
    1,
    2,
    'confirmed',
    tstzrange(
      date_trunc('week', now()) + interval '2 day 14:00',
      date_trunc('week', now()) + interval '2 day 15:00',
      '[)'
    ),
    'Jane Doe'
  ),
  (
    1,
    2,
    'cancelled',
    tstzrange(
      date_trunc('week', now()) + interval '4 day 16:30',
      date_trunc('week', now()) + interval '4 day 17:00',
      '[)'
    ),
    'Mia Lopez'
  );

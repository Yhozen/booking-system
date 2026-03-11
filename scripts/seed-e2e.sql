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
    tstzrange('2026-03-10 09:00:00+00', '2026-03-10 09:30:00+00', '[)'),
    'Alice Johnson'
  ),
  (
    1,
    1,
    'pending',
    tstzrange('2026-03-11 13:00:00+00', '2026-03-11 14:00:00+00', '[)'),
    'Ben Carter'
  ),
  (
    1,
    2,
    'confirmed',
    tstzrange('2026-03-11 14:00:00+00', '2026-03-11 15:00:00+00', '[)'),
    'Jane Doe'
  ),
  (
    1,
    2,
    'cancelled',
    tstzrange('2026-03-13 16:30:00+00', '2026-03-13 17:00:00+00', '[)'),
    'Mia Lopez'
  );

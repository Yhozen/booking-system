type TestDb = {
  query<T>(sql: string): Promise<{ rows: T[] }>;
};

type CreateProviderInput = {
  displayName?: string;
  timezone?: string;
  defaultCapacity?: number;
  bookingHorizonDays?: number;
};

export const createProvider = async (
  db: TestDb,
  {
    displayName = "Provider",
    timezone = "UTC",
    defaultCapacity = 1,
    bookingHorizonDays,
  }: CreateProviderInput = {},
) => {
  const bookingHorizonSql =
    bookingHorizonDays === undefined ? "default" : `${bookingHorizonDays}`;

  const provider = await db.query<{ id: number }>(
    `insert into users (display_name, timezone, default_capacity, booking_horizon_days)
     values ('${displayName}', '${timezone}', ${defaultCapacity}, ${bookingHorizonSql})
     returning id`,
  );

  return provider.rows[0]!.id;
};

type CreateServiceInput = {
  name?: string;
  durationMinutes?: number;
  capacityOverride?: number;
};

export const createService = async (
  db: TestDb,
  providerUserId: number,
  {
    name = "Consultation",
    durationMinutes = 30,
    capacityOverride,
  }: CreateServiceInput = {},
) => {
  const capacityOverrideSql =
    capacityOverride === undefined ? "null" : `${capacityOverride}`;

  const service = await db.query<{ id: number }>(
    `insert into services (provider_user_id, name, duration_minutes, capacity_override)
     values (${providerUserId}, '${name}', ${durationMinutes}, ${capacityOverrideSql})
     returning id`,
  );

  return service.rows[0]!.id;
};

export const createProviderAndService = async (
  db: TestDb,
  {
    displayName,
    timezone,
    defaultCapacity,
    bookingHorizonDays,
    serviceName,
    durationMinutes,
    capacityOverride,
  }: CreateProviderInput &
    CreateServiceInput & {
      serviceName?: string;
    } = {},
) => {
  const providerUserId = await createProvider(db, {
    displayName,
    timezone,
    defaultCapacity,
    bookingHorizonDays,
  });

  const serviceId = await createService(db, providerUserId, {
    name: serviceName,
    durationMinutes,
    capacityOverride,
  });

  return { providerUserId, serviceId };
};

// @vitest-environment node

import { afterAll, expect, it } from "vitest";

import { createProviderAndService } from "@/server/db/booking/test-helpers";
import { createBookingDbForTest } from "@/test/pglite-booking";

const { db, cleanup } = await createBookingDbForTest();

afterAll(cleanup);

it("materializes generated windows for an upcoming range from active weekly rules", async () => {
  const { providerUserId } = await createProviderAndService(db, {
    timezone: "America/New_York",
  });

  const rule = await db.query<{ id: number }>(
    `insert into weekly_availability_rules (
       provider_user_id,
       service_id,
       weekday,
       start_local,
       end_local,
       is_active
     ) values (
       ${providerUserId},
       null,
       1,
       '09:00',
       '11:00',
       true
     )
     returning id`,
  );

  await db.query(
    `select materialize_availability_windows('2026-01-05', '2026-01-12')`,
  );

  const windows = await db.query<{
    source: string;
    rule_id: number;
    start_utc: string;
    end_utc: string;
    lower_inc: boolean;
    upper_inc: boolean;
  }>(
    `select
       source,
       rule_id,
       (lower(slot) at time zone 'UTC')::text as start_utc,
       (upper(slot) at time zone 'UTC')::text as end_utc,
       lower_inc(slot) as lower_inc,
       upper_inc(slot) as upper_inc
     from availability_windows
     where provider_user_id = ${providerUserId}
     order by lower(slot)`,
  );

  expect(windows.rows).toHaveLength(1);
  expect(windows.rows[0]!.source).toBe("generated");
  expect(windows.rows[0]!.rule_id).toBe(rule.rows[0]!.id);
  expect(windows.rows[0]!.start_utc).toBe("2026-01-05 14:00:00");
  expect(windows.rows[0]!.end_utc).toBe("2026-01-05 16:00:00");
  expect(windows.rows[0]!.lower_inc).toBe(true);
  expect(windows.rows[0]!.upper_inc).toBe(false);
});

it("is idempotent when rerun for the same date range", async () => {
  const { providerUserId } = await createProviderAndService(db);

  await db.query(
    `insert into weekly_availability_rules (
       provider_user_id,
       service_id,
       weekday,
       start_local,
       end_local,
       is_active
     ) values (
       ${providerUserId},
       null,
       2,
       '10:00',
       '10:30',
       true
     )`,
  );

  await db.query(
    `select materialize_availability_windows('2026-01-06', '2026-01-13')`,
  );
  await db.query(
    `select materialize_availability_windows('2026-01-06', '2026-01-13')`,
  );

  const counts = await db.query<{
    generated_count: number;
    total_count: number;
  }>(
    `select
       count(*) filter (where source = 'generated')::int as generated_count,
       count(*)::int as total_count
     from availability_windows
     where provider_user_id = ${providerUserId}`,
  );

  expect(counts.rows[0]!.generated_count).toBe(1);
  expect(counts.rows[0]!.total_count).toBe(1);
});

it("keeps manual windows while rematerializing generated windows", async () => {
  const { providerUserId } = await createProviderAndService(db);

  const rule = await db.query<{ id: number }>(
    `insert into weekly_availability_rules (
       provider_user_id,
       service_id,
       weekday,
       start_local,
       end_local,
       is_active
     ) values (
       ${providerUserId},
       null,
       3,
       '09:00',
       '10:00',
       true
     )
     returning id`,
  );

  await db.query(
    `insert into availability_windows (
       provider_user_id,
       service_id,
       slot,
       source
     ) values (
       ${providerUserId},
       null,
       tstzrange('2026-01-07 12:00:00+00', '2026-01-07 13:00:00+00', '[)'),
       'manual'
     )`,
  );

  await db.query(
    `select materialize_availability_windows('2026-01-07', '2026-01-14')`,
  );

  await db.query(
    `update weekly_availability_rules
     set is_active = false
     where id = ${rule.rows[0]!.id}`,
  );

  await db.query(
    `select materialize_availability_windows('2026-01-07', '2026-01-14')`,
  );

  const counts = await db.query<{
    manual_count: number;
    generated_count: number;
  }>(
    `select
       count(*) filter (where source = 'manual')::int as manual_count,
       count(*) filter (where source = 'generated')::int as generated_count
     from availability_windows
     where provider_user_id = ${providerUserId}`,
  );

  expect(counts.rows[0]!.manual_count).toBe(1);
  expect(counts.rows[0]!.generated_count).toBe(0);
});

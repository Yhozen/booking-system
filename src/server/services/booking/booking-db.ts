import type { PGlite } from "@electric-sql/pglite";

import type { PrismaClient } from "@/server/db";

export type SqlQueryResult<T> = {
  rows: T[];
};

export interface BookingDb {
  query<T>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<SqlQueryResult<T>>;
  execute(sql: string, params?: readonly unknown[]): Promise<void>;
}

type PrismaQueryable = Pick<
  PrismaClient,
  "$executeRawUnsafe" | "$queryRawUnsafe"
>;

export const createPrismaBookingDb = (prisma: PrismaQueryable): BookingDb => {
  return {
    async query<T>(sql: string, params: readonly unknown[] = []) {
      const rows = await prisma.$queryRawUnsafe<T[]>(sql, ...params);
      return { rows };
    },
    async execute(sql: string, params: readonly unknown[] = []) {
      await prisma.$executeRawUnsafe(sql, ...params);
    },
  };
};

type PgliteQueryable = Pick<PGlite, "query">;

export const createPgliteBookingDb = (db: PgliteQueryable): BookingDb => {
  return {
    query<T>(sql: string, params: readonly unknown[] = []) {
      return db.query<T>(sql, Array.from(params));
    },
    async execute(sql: string, params: readonly unknown[] = []) {
      await db.query(sql, Array.from(params));
    },
  };
};

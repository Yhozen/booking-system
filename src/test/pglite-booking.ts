import { PrismaClient } from "@/server/db";
import { readLatestBookingMigrationSql } from "@/test/prisma-booking-migration";
import { createRawPgliteForTest } from "@/test/pglite-prisma";
import { PrismaPGlite } from "pglite-prisma-adapter";

export const createBookingDbForTest = async () => {
  const db = await createRawPgliteForTest();

  await db.exec(await readLatestBookingMigrationSql());

  return {
    db,
    cleanup: async () => {
      await db.close();
    },
  };
};

export const createBookingPrismaForTest = async () => {
  const { db } = await createBookingDbForTest();

  const adapter = new PrismaPGlite(db);
  const prisma = new PrismaClient({ adapter });

  return {
    db,
    prisma,
    cleanup: async () => {
      await prisma.$disconnect();
      await db.close();
    },
  };
};

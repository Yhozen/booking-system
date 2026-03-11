import { env } from "@/env";
import { PrismaClient as PrismaClientGenerated } from "../../generated/prisma";

export const PrismaClient = PrismaClientGenerated;
export type PrismaClient = PrismaClientGenerated

const createPrismaClient = () =>
  new PrismaClientGenerated({
    log:
      env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;

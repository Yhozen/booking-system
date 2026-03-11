import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const MIGRATIONS_DIR = resolve(process.cwd(), "prisma", "migrations");

let migrationSqlPromise: Promise<string> | undefined;

export const findLatestBookingMigrationSqlPath = async (): Promise<string> => {
  const entries = await readdir(MIGRATIONS_DIR, { withFileTypes: true });

  const bookingMigrationDirs = entries
    .filter((entry) => entry.isDirectory() && entry.name.includes("booking"))
    .map((entry) => entry.name)
    .sort();

  const latestDir = bookingMigrationDirs.at(-1);
  if (!latestDir) {
    throw new Error(
      "No booking migration directory found in prisma/migrations",
    );
  }

  return join(MIGRATIONS_DIR, latestDir, "migration.sql");
};

export const readLatestBookingMigrationSql = async (): Promise<string> => {
  migrationSqlPromise ??= (async () => {
    const migrationPath = await findLatestBookingMigrationSqlPath();
    return readFile(migrationPath, "utf8");
  })();

  return migrationSqlPromise;
};

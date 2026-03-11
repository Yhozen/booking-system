import { execSync } from "node:child_process";

const e2eDatabaseUrl = process.env.DATABASE_URL_E2E;
const appDatabaseUrl = process.env.DATABASE_URL;

if (!e2eDatabaseUrl) {
  throw new Error("DATABASE_URL_E2E is required for db:seed:e2e.");
}

if (appDatabaseUrl && appDatabaseUrl === e2eDatabaseUrl) {
  throw new Error(
    "DATABASE_URL_E2E must be different from DATABASE_URL to protect app data.",
  );
}

const parsedUrl = new URL(e2eDatabaseUrl);
const host = parsedUrl.hostname.toLowerCase();
const databaseName = parsedUrl.pathname.replace(/^\//, "").toLowerCase();

if (!["localhost", "127.0.0.1", "postgres"].includes(host)) {
  throw new Error(
    `Refusing to seed non-local host "${parsedUrl.hostname}". Expected a local test database.`,
  );
}

if (!databaseName.includes("e2e")) {
  throw new Error(
    `Refusing to seed database "${databaseName}". DATABASE_URL_E2E must point to an e2e database.`,
  );
}

execSync(
  "bunx prisma db execute --schema prisma/schema.prisma --file scripts/seed-e2e.sql",
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: e2eDatabaseUrl,
    },
  },
);

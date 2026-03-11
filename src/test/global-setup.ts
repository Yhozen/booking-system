export default function globalSetup(): void {
  process.env.DATABASE_URL =
    "postgresql://testing:testing@localhost/mydatabase";
}

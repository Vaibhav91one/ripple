// Plain ESM so it runs from the standalone deploy (no tsx): node scripts/migrate.mjs
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("DATABASE_URL is not set: skipping migrations");
  process.exit(0);
}
const sql = postgres(url, { max: 1, onnotice: () => {} });
await migrate(drizzle(sql), { migrationsFolder: "lib/db/migrations" });
await sql.end();
console.log("migrations applied");

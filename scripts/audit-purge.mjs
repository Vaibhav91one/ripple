// Plain ESM like migrate.mjs: node scripts/audit-purge.mjs [days=90]. Deletes audit_log rows older than that.
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("DATABASE_URL is not set: skipping audit purge");
  process.exit(0);
}
const days = Number(process.argv[2] ?? 90);
const sql = postgres(url, { max: 1, onnotice: () => {} });
const rows = await sql`delete from audit_log where at < now() - make_interval(days => ${days}) returning id`;
await sql.end();
console.log(`audit purge: deleted ${rows.length} rows older than ${days} days`);

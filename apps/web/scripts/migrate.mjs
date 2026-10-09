// Applies db/migrations/*.sql to the database, in order, once each.
//   npm run db:migrate -w web
// Uses DATABASE_URL_UNPOOLED (Neon's direct connection) when set, as Neon
// recommends for schema changes; falls back to DATABASE_URL.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "..", "db", "migrations");
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url || url.startsWith("pglite:")) {
  console.error("Set DATABASE_URL_UNPOOLED (or DATABASE_URL) to your Neon connection string.");
  process.exit(1);
}
if (url.includes("-pooler.")) console.warn("Warning: this is a pooled URL. Neon recommends the direct (unpooled) URL for migrations.");

// Pin strict TLS (see strictSsl in src/server/db.ts).
const client = new pg.Client({ connectionString: url.replace(/([?&])sslmode=(require|prefer|verify-ca)\b/, "$1sslmode=verify-full") });
await client.connect();
try {
  await client.query(`create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now())`);
  const done = new Set((await client.query(`select name from public.schema_migrations`)).rows.map((r) => r.name));
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    process.stdout.write(`Applying ${file} ... `);
    await client.query("begin");
    try {
      await client.query(readFileSync(join(dir, file), "utf8"));
      await client.query(`insert into public.schema_migrations (name) values ($1)`, [file]);
      await client.query("commit");
      applied++;
      console.log("done");
    } catch (e) {
      await client.query("rollback");
      console.log("failed");
      throw e;
    }
  }
  console.log(applied ? `Applied ${applied} migration(s).` : "Database is up to date.");
} finally {
  await client.end();
}

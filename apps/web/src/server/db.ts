import "server-only";
import type { PGlite } from "@electric-sql/pglite";
import { Pool, types } from "pg";

/**
 * Database access. Production runs on Neon Postgres through `node-postgres`,
 * using the pooled connection string (DATABASE_URL). Tests and the end-to-end
 * suite may use an in-memory Postgres instead (DATABASE_URL=pglite:memory).
 *
 * Schema changes are not applied here: run `npm run db:migrate`, which uses
 * the direct (unpooled) connection as Neon recommends.
 */

export interface QueryResult<T> {
  rows: T[];
  affectedRows: number;
}

export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
}

export interface Db extends Queryable {
  /** Run `fn` in one transaction; it rolls back if `fn` throws. */
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
}

export type Tx = Queryable;

// Postgres "timestamp with time zone" arrives as a Date in both drivers.
// int8 (bigint) stays a string in pg; queries cast counts with ::int.
types.setTypeParser(types.builtins.NUMERIC, (v) => v);

export function postgresDb(pool: Pool): Db {
  return {
    async query<T>(sql: string, params: unknown[] = []) {
      const r = await pool.query(sql, params as unknown[]);
      return { rows: r.rows as T[], affectedRows: r.rowCount ?? 0 };
    },
    async transaction<T>(fn: (tx: Queryable) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const tx: Queryable = {
          async query<R>(sql: string, params: unknown[] = []) {
            const r = await client.query(sql, params as unknown[]);
            return { rows: r.rows as R[], affectedRows: r.rowCount ?? 0 };
          },
        };
        const out = await fn(tx);
        await client.query("commit");
        return out;
      } catch (e) {
        await client.query("rollback").catch(() => undefined);
        throw e;
      } finally {
        client.release();
      }
    },
  };
}

export function pgliteDb(pg: PGlite): Db {
  const wrap = (q: Pick<PGlite, "query">): Queryable => ({
    async query<T>(sql: string, params: unknown[] = []) {
      const r = await q.query<T>(sql, params);
      return { rows: r.rows, affectedRows: r.affectedRows ?? 0 };
    },
  });
  return {
    ...wrap(pg),
    transaction: (fn) => pg.transaction((tx) => fn(wrap(tx))),
  };
}

/** In-memory Postgres with every migration applied. Tests only. */
export async function memoryDb(): Promise<{ db: Db; pg: PGlite }> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { readdirSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const pg = new PGlite();
  for (const file of readdirSync(join(process.cwd(), "db", "migrations")).filter((f) => f.endsWith(".sql")).sort()) {
    await pg.exec(readFileSync(join(process.cwd(), "db", "migrations", file), "utf8"));
  }
  return { db: pgliteDb(pg), pg };
}

/**
 * Neon URLs say sslmode=require, which pg currently treats as verify-full
 * and will weaken in its next major version. Pin today's strict behavior.
 */
export function strictSsl(url: string): string {
  return url.replace(/([?&])sslmode=(require|prefer|verify-ca)\b/, "$1sslmode=verify-full");
}

// One pool per server process (survives Next.js dev hot reloads).
const g = globalThis as unknown as { __klarDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  g.__klarDb ??= (async () => {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. Add your Neon connection string to apps/web/.env.local.");
    if (url === "pglite:memory") {
      if (process.env.NODE_ENV === "production") throw new Error("pglite:memory is for tests only.");
      return (await memoryDb()).db;
    }
    return postgresDb(new Pool({ connectionString: strictSsl(url), max: 10, idleTimeoutMillis: 30_000 }));
  })();
  return g.__klarDb;
}

/**
 * Run queries as one student with row-level security enforced: the
 * transaction switches to the restricted klar_student role and sets
 * klar.user_id, which the RLS policies compare against. Both settings are
 * transaction-local, so they're safe with Neon's pooled (PgBouncer) connections.
 */
export async function asStudent<T>(db: Db, userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(`set local role klar_student`);
    await tx.query(`select set_config('klar.user_id', $1, true)`, [userId]);
    return fn(tx);
  });
}

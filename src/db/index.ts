import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

// Cached on globalThis so dev hot reloads never open the embedded database twice.
const cache = globalThis as unknown as { dbPromise?: Promise<Db> };

export function getDb(): Promise<Db> {
  return (cache.dbPromise ??= connect());
}

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { drizzle } = await import("drizzle-orm/neon-http");
    return drizzle(url, { schema }) as unknown as Db;
  }
  if (process.env.VERCEL) throw new Error("DATABASE_URL is not set");
  const { mkdirSync } = await import("node:fs");
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  mkdirSync(".data", { recursive: true });
  return drizzle(new PGlite(".data/pglite"), { schema }) as unknown as Db;
}

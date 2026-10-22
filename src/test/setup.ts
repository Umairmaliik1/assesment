import { vi } from "vitest";

// Every test file gets its own migrated and seeded in-memory Postgres.
vi.mock("@/db", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const schema = await import("@/db/schema");
  const { SEED_USERS } = await import("@/db/seed");
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  await db.insert(schema.users).values(SEED_USERS);
  return { getDb: async () => db };
});

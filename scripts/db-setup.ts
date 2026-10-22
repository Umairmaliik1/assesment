import { getDb } from "@/db";
import { users } from "@/db/schema";
import { SEED_USERS } from "@/db/seed";

const migrationsFolder = "drizzle";

// Neon's HTTP driver cannot run transactions, so migrations use its WebSocket pool to apply each one atomically.
async function migrateNeon(connectionString: string) {
  const { Pool } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-serverless");
  const { migrate } = await import("drizzle-orm/neon-serverless/migrator");
  const pool = new Pool({ connectionString });
  try {
    await migrate(drizzle(pool), { migrationsFolder });
  } finally {
    await pool.end();
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (url) await migrateNeon(url);
  else {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate((await getDb()) as never, { migrationsFolder });
  }
  await (await getDb()).insert(users).values(SEED_USERS).onConflictDoNothing();
  console.log(`Database ready (${url ? "Postgres" : "embedded PGlite"})`);
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);

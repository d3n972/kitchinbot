import path from "node:path";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import { createLogger, type Logger } from "../logger.ts";
import { createDb, type DatabaseHandle } from "./client.ts";

// Arbitrary, stable key so concurrent boots serialize their migrations.
const MIGRATION_LOCK_ID = 7_274_413;

export async function runMigrations(
  handle: DatabaseHandle,
  logger?: Logger,
): Promise<void> {
  const folder = path.join(import.meta.dir, "../../drizzle");

  // Reserve one connection so the session-level advisory lock and the
  // migrations run on the same connection. The lock dies with the
  // connection even if the process is killed.
  const reserved = await handle.sql.reserve();
  try {
    await reserved`select pg_advisory_lock(${MIGRATION_LOCK_ID})`;
    try {
      logger?.info("Applying database migrations");
      await migrate(drizzle(reserved), { migrationsFolder: folder });
    } finally {
      await reserved`select pg_advisory_unlock(${MIGRATION_LOCK_ID})`;
    }
  } finally {
    reserved.release();
  }

  logger?.info("Database migrations up to date");
}

if (import.meta.main) {
  let close: (() => Promise<void>) | undefined;
  try {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required to run migrations");
    }

    const rawLevel = process.env.LOG_LEVEL;
    const logLevel =
      rawLevel === "debug" ||
      rawLevel === "warn" ||
      rawLevel === "error"
        ? rawLevel
        : "info";

    const logger = createLogger(logLevel);
    const handle = createDb(databaseUrl);
    close = handle.close;
    await runMigrations(handle, logger);
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  } finally {
    await close?.();
  }
}

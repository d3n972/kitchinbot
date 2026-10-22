import { Events } from "discord.js";
import { loadConfig } from "./src/config.ts";
import { createDb } from "./src/db/client.ts";
import { runMigrations } from "./src/db/migrate.ts";
import {
  createMealRepository,
  createOrderRepository,
  createUserRepository,
} from "./src/db/repositories.ts";
import { createDiscordClient, registerCommands } from "./src/discord/client.ts";
import { createInteractionHandler } from "./src/discord/router.ts";
import { startHealthServer } from "./src/health.ts";
import { createLogger } from "./src/logger.ts";
import { createOrderNotifier } from "./src/notifications/index.ts";
import { createMealService } from "./src/services/meals.ts";
import { createOrderService } from "./src/services/orders.ts";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  logger.info("Starting kitchenbot", {
    mode: config.isDev ? "development" : "production",
    commandScope: config.discord.guildId ? "guild" : "global",
    adminDiscordId: config.adminDiscordId,
  });

  const database = createDb(config.databaseUrl);

  try {
    await runMigrations(database, logger);
  } catch (error) {
    logger.error("Database migrations failed", error);
    await database.close();
    process.exitCode = 1;
    return;
  }

  const client = createDiscordClient();
  const health = startHealthServer({
    port: config.healthPort,
    isReady: () => client.isReady(),
    logger,
  });
  const notifier = createOrderNotifier({ client, config, logger });
  const mealRepository = createMealRepository(database.db);

  const orders = createOrderService({
    orders: createOrderRepository(database.db),
    users: createUserRepository(database.db),
    meals: mealRepository,
    notifier,
    logger,
  });
  const meals = createMealService(mealRepository);

  const ctx = {
    orders,
    meals,
    adminDiscordId: config.adminDiscordId,
    logger,
  };

  client.on(Events.InteractionCreate, createInteractionHandler(ctx));
  client.on(Events.Error, (error) => {
    logger.error("Discord client error", error);
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("Shutting down", { signal });

    try {
      client.destroy();
    } catch (error) {
      logger.warn("Failed to destroy Discord client", error);
    }
    health.stop();
    try {
      await database.close();
    } catch (error) {
      logger.error("Failed to close database connection", error);
    }
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  client.once(Events.ClientReady, (ready) => {
    logger.info("Discord bot ready", {
      tag: ready.user.tag,
      id: ready.user.id,
    });

    void registerCommands(client, config, logger).catch((error) => {
      logger.error("Slash command registration failed", error);
    });
  });

  try {
    await client.login(config.discord.token);
  } catch (error) {
    logger.error("Discord login failed", error);
    try {
      client.destroy();
    } catch {
      // ignore
    }
    health.stop();
    await database.close();
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

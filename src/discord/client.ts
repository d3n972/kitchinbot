import { Client, GatewayIntentBits } from "discord.js";
import type { AppConfig } from "../config.ts";
import type { Logger } from "../logger.ts";
import { menuCommand } from "./commands/menu.ts";

export function createDiscordClient(): Client {
  return new Client({ intents: [GatewayIntentBits.Guilds] });
}

export async function registerCommands(
  client: Client,
  config: AppConfig,
  logger: Logger,
): Promise<void> {
  const application = client.application;
  if (!application) {
    throw new Error("Discord application is not available");
  }

  if (application.id !== config.discord.applicationId) {
    throw new Error(
      `DISCORD_APP_ID does not match the token's application ` +
        `(configured ${config.discord.applicationId}, actual ${application.id})`,
    );
  }

  if (config.discord.guildId) {
    const guild = await client.guilds.fetch(config.discord.guildId);
    await guild.commands.set([menuCommand]);
    logger.info("Registered /menu command", {
      scope: "guild",
      guildId: guild.id,
    });
    return;
  }

  await application.commands.set([menuCommand]);
  logger.info(
    "Registered /menu command globally (propagation can take up to an hour)",
  );
}

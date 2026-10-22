import { EmbedBuilder, type Client } from "discord.js";
import type { OrderWithUser } from "../services/repositories.ts";
import { buildDmDescription } from "./format.ts";

/** Sends the administrator a DM. Throws on failure. */
export async function sendDiscordDm(
  client: Client,
  adminDiscordId: string,
  order: OrderWithUser,
): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle("🍽️ New Order")
    .setDescription(buildDmDescription(order))
    .setColor(0xf59e0b)
    .setTimestamp(order.createdAt);

  await client.users.send(adminDiscordId, {
    embeds: [embed],
    allowedMentions: { parse: [] },
  });
}

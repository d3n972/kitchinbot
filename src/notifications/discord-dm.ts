import type { Client } from "discord.js";
import { orderDmView } from "../discord/views/order-dm.ts";
import type { OrderWithUser } from "../services/repositories.ts";

/** Sends the administrator the new-order DM with lifecycle buttons. */
export async function sendDiscordDm(
  client: Client,
  adminDiscordId: string,
  order: OrderWithUser,
): Promise<void> {
  await client.users.send(adminDiscordId, orderDmView(order));
}

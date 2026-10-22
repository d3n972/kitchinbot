import type { Client } from "discord.js";
import type { AppConfig } from "../config.ts";
import type { Logger } from "../logger.ts";
import type { OrderWithUser } from "../services/repositories.ts";
import { sendDiscordDm } from "./discord-dm.ts";
import { createNtfySender } from "./ntfy.ts";
import type { OrderNotifier } from "./types.ts";

export interface NotificationDeps {
  client: Client;
  config: AppConfig;
  logger: Logger;
}

/**
 * Fans a new order out to both delivery channels independently. A failed
 * delivery is logged and never affects the persisted order.
 */
export function createOrderNotifier(deps: NotificationDeps): OrderNotifier {
  const { client, config, logger } = deps;
  const sendNtfy = createNtfySender(config.ntfy);

  return {
    async notifyNewOrder(order: OrderWithUser) {
      const results = await Promise.allSettled([
        sendDiscordDm(client, config.adminDiscordId, order),
        sendNtfy(order),
      ]);

      const channels = ["discord-dm", "ntfy"] as const;
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          logger.error(`Notification failed (${channels[index]})`, {
            orderId: order.id,
            error: result.reason,
          });
        } else {
          logger.debug(`Notification delivered (${channels[index]})`, {
            orderId: order.id,
          });
        }
      });
    },
  };
}

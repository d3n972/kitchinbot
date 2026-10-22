import type { Logger } from "../logger.ts";
import type { MealService } from "../services/meals.ts";
import type { OrderService } from "../services/orders.ts";

export interface BotContext {
  orders: OrderService;
  meals: MealService;
  adminDiscordId: string;
  logger: Logger;
}

export function isAdmin(ctx: BotContext, userId: string): boolean {
  return userId === ctx.adminDiscordId;
}

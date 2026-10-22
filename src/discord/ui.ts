import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type BaseMessageOptions,
  type User,
} from "discord.js";
import type { OrderStatus } from "../db/schema.ts";
import { STATUS_LABELS } from "../domain/order-status.ts";
import type { OrderActor } from "../services/orders.ts";
import type { OrderWithUser } from "../services/repositories.ts";
import { truncate } from "../text.ts";

export const COLORS = {
  brand: 0xf59e0b,
  success: 0x22c55e,
  danger: 0xef4444,
  info: 0x3b82f6,
  muted: 0x64748b,
} as const;

export function actorOf(
  user: Pick<User, "id" | "username" | "globalName">,
): OrderActor {
  return {
    discordId: user.id,
    displayName: user.globalName || user.username,
  };
}

export function parseId(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parsePage(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.trunc(parsed) : 1;
}

export function discordTimestamp(date: Date, style = "f"): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
}

export function statusLabel(status: OrderStatus): string {
  return STATUS_LABELS[status];
}

export function contentBlock(order: OrderWithUser, max = 3500): string {
  if (order.mealName) return truncate(order.mealName, max);
  return `Custom:\n${truncate(order.customText ?? "", max)}`;
}

export function confirmationView(order: OrderWithUser): BaseMessageOptions {
  const content = order.mealName
    ? order.mealName
    : `Custom order:\n\n${truncate(order.customText ?? "", 3300)}`;

  const embed = new EmbedBuilder()
    .setTitle("✅ Order placed")
    .setColor(COLORS.success)
    .setDescription(
      `${content}\n\nOrder #${order.id}\nStatus: ${order.status}`,
    );

  return { embeds: [embed], allowedMentions: { parse: [] } };
}

export function errorView(
  message: string,
  components: BaseMessageOptions["components"] = [],
): BaseMessageOptions {
  const embed = new EmbedBuilder()
    .setTitle("⚠️ Something went wrong")
    .setColor(COLORS.danger)
    .setDescription(message);

  return { embeds: [embed], components };
}

export function backButton(customId: string, label = "← Back"): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(ButtonStyle.Secondary);
}

export function navRow(
  previousId: string | null,
  nextId: string | null,
  backId: string,
): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  if (previousId) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(previousId)
        .setLabel("← Prev")
        .setStyle(ButtonStyle.Secondary),
    );
  }
  if (nextId) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(nextId)
        .setLabel("Next →")
        .setStyle(ButtonStyle.Secondary),
    );
  }
  row.addComponents(backButton(backId));
  return row;
}

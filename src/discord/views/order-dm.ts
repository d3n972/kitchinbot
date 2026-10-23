import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type BaseMessageOptions,
  type ButtonInteraction,
} from "discord.js";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../domain/errors.ts";
import {
  availableActions,
  type OrderAction,
} from "../../domain/order-status.ts";
import { buildDmDescription } from "../../notifications/format.ts";
import type { OrderWithUser } from "../../services/repositories.ts";
import { truncate } from "../../text.ts";
import type { BotContext } from "../context.ts";
import { COLORS, statusLabel } from "../ui.ts";

// Cancellation stays in the kitchen view; the DM is for moving work forward.
const DM_ACTIONS: readonly OrderAction[] = ["prepare", "ready", "complete"];

const DM_ACTION_LABELS: Partial<Record<OrderAction, string>> = {
  prepare: "Start Preparing",
  ready: "Mark Ready",
  complete: "Done",
};

export function orderDmView(order: OrderWithUser): BaseMessageOptions {
  const embed = new EmbedBuilder()
    .setTitle("🍽️ New Order")
    .setColor(COLORS.brand)
    .setDescription(
      `${buildDmDescription(order)}\n\nStatus: ${statusLabel(order.status)}`,
    )
    .setTimestamp(order.createdAt);

  const embeds = [embed];

  if (order.mealRecipe) {
    embeds.push(
      new EmbedBuilder()
        .setTitle("📝 Recipe")
        .setColor(COLORS.muted)
        .setDescription(truncate(order.mealRecipe, 4000)),
    );
  }

  const actions = availableActions(order.status).filter((action) =>
    DM_ACTIONS.includes(action),
  );

  const row = new ActionRowBuilder<ButtonBuilder>();

  for (const action of actions) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`dm:advance:${order.id}:${action}`)
        .setLabel(DM_ACTION_LABELS[action] ?? action)
        .setStyle(
          action === "complete" ? ButtonStyle.Success : ButtonStyle.Primary,
        ),
    );
  }

  return {
    embeds,
    components: actions.length > 0 ? [row] : [],
    allowedMentions: { parse: [] },
  };
}

export async function handleOrderDmAction(
  ctx: BotContext,
  interaction: ButtonInteraction,
  orderId: number,
  action: OrderAction,
): Promise<void> {
  await interaction.deferUpdate();

  try {
    const order = await ctx.orders.advance(orderId, action);
    await interaction.editReply(orderDmView(order));
  } catch (error) {
    if (error instanceof NotFoundError) {
      await interaction.followUp({ content: error.message });
      return;
    }

    if (error instanceof ValidationError || error instanceof ConflictError) {
      await interaction.followUp({ content: error.message });
      try {
        const latest = await ctx.orders.getById(orderId);
        await interaction.editReply(orderDmView(latest));
      } catch (refreshError) {
        ctx.logger.warn("Failed to refresh order DM after transition error", {
          orderId,
          error: refreshError,
        });
      }
      return;
    }

    throw error;
  }
}

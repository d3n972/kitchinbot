import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  type BaseMessageOptions,
  type ButtonInteraction,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import {
  ACTION_LABELS,
  availableActions,
  type OrderAction,
} from "../../domain/order-status.ts";
import { ConflictError, ValidationError } from "../../domain/errors.ts";
import type { Page } from "../../services/orders.ts";
import type { OrderWithUser } from "../../services/repositories.ts";
import { truncate } from "../../text.ts";
import type { BotContext } from "../context.ts";
import {
  backButton,
  COLORS,
  contentBlock,
  navRow,
  statusLabel,
} from "../ui.ts";

function actionStyle(action: OrderAction): ButtonStyle {
  if (action === "cancel") return ButtonStyle.Danger;
  if (action === "complete") return ButtonStyle.Success;
  return ButtonStyle.Primary;
}

function orderRow(
  order: OrderWithUser,
  page: number,
): ActionRowBuilder<ButtonBuilder> | null {
  const actions = availableActions(order.status);
  if (actions.length === 0) return null;

  const row = new ActionRowBuilder<ButtonBuilder>();

  for (const action of actions) {
    if (action === "cancel") continue;
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`kitchen:act:${order.id}:${action}:${page}`)
        .setLabel(ACTION_LABELS[action])
        .setStyle(actionStyle(action)),
    );
  }

  if (order.mealRecipe) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`kitchen:recipe:${order.id}`)
        .setLabel("📝 Recipe")
        .setStyle(ButtonStyle.Secondary),
    );
  }

  if (actions.includes("cancel")) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`kitchen:act:${order.id}:cancel:${page}`)
        .setLabel(ACTION_LABELS.cancel)
        .setStyle(actionStyle("cancel")),
    );
  }

  return row;
}

export function kitchenView(page: Page<OrderWithUser>): BaseMessageOptions {
  const header = new EmbedBuilder()
    .setTitle("👨‍🍳 KITCHEN")
    .setColor(COLORS.brand)
    .setDescription(
      page.total === 0
        ? "Orders waiting: 0\n\nNothing waiting. 🎉"
        : `Orders waiting: ${page.total}${
            page.pageCount > 1
              ? `\nShowing ${page.items.length} · page ${page.page}/${page.pageCount}`
              : ""
          }`,
    );

  const embeds = [header];
  const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];

  for (const order of page.items) {
    embeds.push(
      new EmbedBuilder()
        .setTitle(
          `#${order.id} · ${order.userDisplayName}`.slice(0, 256),
        )
        .setColor(COLORS.muted)
        .setDescription(
          `${contentBlock(order, 3000)}\n\n${statusLabel(order.status)}`,
        ),
    );

    const row = orderRow(order, page.page);
    if (row) components.push(row);
  }

  components.push(
    navRow(
      page.page > 1 ? `kitchen:list:${page.page - 1}` : null,
      page.page < page.pageCount ? `kitchen:list:${page.page + 1}` : null,
      "home:menu",
    ),
  );

  return { embeds, components, allowedMentions: { parse: [] } };
}

export async function openKitchen(
  ctx: BotContext,
  interaction: ButtonInteraction,
  page: number,
): Promise<void> {
  const result = await ctx.orders.listKitchen(page);
  await interaction.update(kitchenView(result));
}

export async function handleKitchenAction(
  ctx: BotContext,
  interaction: ButtonInteraction,
  orderId: number,
  action: OrderAction,
  page: number,
): Promise<void> {
  await interaction.deferUpdate();

  try {
    await ctx.orders.advance(orderId, action);
  } catch (error) {
    if (error instanceof ValidationError || error instanceof ConflictError) {
      await interaction.followUp({
        content: error.message,
        flags: MessageFlags.Ephemeral,
      });
    } else {
      throw error;
    }
  }

  const result = await ctx.orders.listKitchen(page);
  await interaction.editReply(kitchenView(result));
}

export async function showKitchenRecipe(
  ctx: BotContext,
  interaction: ButtonInteraction,
  orderId: number,
): Promise<void> {
  const order = await ctx.orders.getById(orderId);

  if (!order.mealRecipe) {
    await interaction.reply({
      content: "No recipe was captured for this order.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(
      `📝 ${truncate(order.mealName ?? "Order", 220)} · #${order.id}`,
    )
    .setColor(COLORS.muted)
    .setDescription(truncate(order.mealRecipe, 4000));

  await interaction.reply({
    embeds: [embed],
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
}

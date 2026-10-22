import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type BaseMessageOptions,
  type ButtonInteraction,
  type MessageActionRowComponentBuilder,
  type StringSelectMenuInteraction,
} from "discord.js";
import { NotFoundError } from "../../domain/errors.ts";
import type { Page } from "../../services/orders.ts";
import type { OrderWithUser } from "../../services/repositories.ts";
import { truncate } from "../../text.ts";
import type { BotContext } from "../context.ts";
import {
  actorOf,
  backButton,
  COLORS,
  contentBlock,
  discordTimestamp,
  errorView,
  navRow,
  parseId,
  parsePage,
  statusLabel,
} from "../ui.ts";

function listDescription(orders: OrderWithUser[]): string {
  if (orders.length === 0) {
    return "You haven't placed any orders yet.";
  }

  return orders
    .map((order) => {
      const content = truncate(contentBlock(order, 160), 160);
      return `**#${order.id} · ${order.status}**\n${content}`;
    })
    .join("\n\n");
}

export function myOrdersView(
  page: Page<OrderWithUser>,
): BaseMessageOptions {
  const embed = new EmbedBuilder()
    .setTitle("📋 MY ORDERS")
    .setColor(COLORS.brand)
    .setDescription(listDescription(page.items))
    .setFooter({
      text:
        page.total > 0
          ? `${page.total} order${page.total === 1 ? "" : "s"}${
              page.pageCount > 1
                ? ` · page ${page.page}/${page.pageCount}`
                : ""
            }`
          : "No orders yet",
    });

  const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];

  if (page.items.length > 0) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`orders:select:${page.page}`)
      .setPlaceholder("View an order");

    for (const order of page.items) {
      menu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(truncate(`#${order.id} · ${order.status}`, 100))
          .setDescription(truncate(contentBlock(order, 90), 100))
          .setValue(`orders:view:${order.id}:${page.page}`),
      );
    }

    components.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
    );
  }

  components.push(
    navRow(
      page.page > 1 ? `orders:list:${page.page - 1}` : null,
      page.page < page.pageCount ? `orders:list:${page.page + 1}` : null,
      "home:menu",
    ),
  );

  return { embeds: [embed], components, allowedMentions: { parse: [] } };
}

export function orderDetailView(
  order: OrderWithUser,
  page: number,
): BaseMessageOptions {
  const embed = new EmbedBuilder()
    .setTitle(`Order #${order.id}`)
    .setColor(COLORS.info)
    .setDescription(contentBlock(order, 3800))
    .addFields(
      { name: "Status", value: statusLabel(order.status), inline: true },
      {
        name: "Placed",
        value: discordTimestamp(order.createdAt),
        inline: true,
      },
    );

  if (order.updatedAt.getTime() !== order.createdAt.getTime()) {
    embed.addFields({
      name: "Updated",
      value: discordTimestamp(order.updatedAt),
      inline: true,
    });
  }

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        backButton(`orders:list:${page}`, "← My Orders"),
      ),
    ],
    allowedMentions: { parse: [] },
  };
}

export async function openMyOrders(
  ctx: BotContext,
  interaction: ButtonInteraction,
  page: number,
): Promise<void> {
  const result = await ctx.orders.listForActor(
    actorOf(interaction.user),
    page,
  );
  await interaction.update(myOrdersView(result));
}

export async function handleMyOrdersSelect(
  ctx: BotContext,
  interaction: StringSelectMenuInteraction,
  page: number,
): Promise<void> {
  const value = interaction.values[0];
  if (!value?.startsWith("orders:view:")) return;

  const [, , rawOrderId, rawPage] = value.split(":");
  const orderId = parseId(rawOrderId);
  if (!orderId) return;

  await openOrderDetail(
    ctx,
    interaction,
    orderId,
    parsePage(rawPage ?? String(page)),
  );
}

export async function openOrderDetail(
  ctx: BotContext,
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  orderId: number,
  page: number,
): Promise<void> {
  try {
    const order = await ctx.orders.getForActor(
      orderId,
      actorOf(interaction.user),
    );
    await interaction.update(orderDetailView(order, page));
  } catch (error) {
    if (error instanceof NotFoundError) {
      await interaction.update(
        errorView("That order could not be found.", [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            backButton(`orders:list:${page}`, "← My Orders"),
          ),
        ]),
      );
      return;
    }
    throw error;
  }
}

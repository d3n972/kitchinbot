import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type BaseMessageOptions,
} from "discord.js";
import { isAdmin, type BotContext } from "../context.ts";
import { COLORS } from "../ui.ts";

export function homeView(ctx: BotContext, userId: string): BaseMessageOptions {
  const embed = new EmbedBuilder()
    .setTitle("🍽️ HOME KITCHEN")
    .setDescription("What would you like to do?")
    .setColor(COLORS.brand);

  const rows = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("home:order")
        .setLabel("🍽️ Order")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("home:my-orders")
        .setLabel("📋 My Orders")
        .setStyle(ButtonStyle.Secondary),
    ),
  ];

  if (isAdmin(ctx, userId)) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("home:kitchen")
          .setLabel("👨‍🍳 Kitchen")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("home:meals")
          .setLabel("📖 Meals")
          .setStyle(ButtonStyle.Secondary),
      ),
    );
  }

  return { embeds: [embed], components: rows };
}

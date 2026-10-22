import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  type BaseMessageOptions,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from "discord.js";
import type { Meal } from "../../db/schema.ts";
import { ValidationError } from "../../domain/errors.ts";
import { truncate } from "../../text.ts";
import type { BotContext } from "../context.ts";
import {
  actorOf,
  backButton,
  COLORS,
  confirmationView,
  errorView,
  parseId,
} from "../ui.ts";

const SELECT_ID = "order:select";
const MODAL_ID = "order:custom-modal";
const FIELD_ID = "order_custom_text";
const CUSTOM_VALUE = "custom";
const MAX_SELECT_OPTIONS = 25;

function selectMenu(meals: Meal[]): StringSelectMenuBuilder {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(SELECT_ID)
    .setPlaceholder("Select a meal");

  // Reserve one slot for the custom option.
  for (const meal of meals.slice(0, MAX_SELECT_OPTIONS - 1)) {
    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(truncate(meal.name, 100))
        .setValue(`meal:${meal.id}`),
    );
  }

  menu.addOptions(
    new StringSelectMenuOptionBuilder()
      .setLabel("✍️ Custom")
      .setDescription("Describe exactly what you would like")
      .setValue(CUSTOM_VALUE),
  );

  return menu;
}

export function orderStartView(meals: Meal[]): BaseMessageOptions {
  const embed = new EmbedBuilder()
    .setTitle("🍽️ ORDER")
    .setColor(COLORS.brand)
    .setDescription(
      meals.length > 0
        ? "Select a meal:"
        : "No meals are available right now.\nYou can still place a custom order.",
    );

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        selectMenu(meals),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        backButton("home:menu"),
      ),
    ],
  };
}

export function orderConfirmView(meal: Meal): BaseMessageOptions {
  const embed = new EmbedBuilder()
    .setTitle(`🍛 ${truncate(meal.name, 200)}`)
    .setColor(COLORS.brand)
    .setDescription("Ready to order this?");

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`order:place:${meal.id}`)
          .setLabel("Order")
          .setStyle(ButtonStyle.Success),
        backButton("order:start"),
      ),
    ],
  };
}

function customOrderModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(MODAL_ID)
    .setTitle("✍️ Custom order")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(FIELD_ID)
          .setLabel("What would you like?")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(4000)
          .setPlaceholder(
            "2 chicken curry, one without onions and an omurice",
          ),
      ),
    );
}

function orderError(message: string): BaseMessageOptions {
  return errorView(message, [
    new ActionRowBuilder<ButtonBuilder>().addComponents(backButton("order:start")),
  ]);
}

export async function openOrder(
  ctx: BotContext,
  interaction: ButtonInteraction,
): Promise<void> {
  const meals = await ctx.meals.listEnabled();
  await interaction.update(orderStartView(meals));
}

export async function handleOrderSelect(
  ctx: BotContext,
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  const value = interaction.values[0];
  if (!value) return;

  if (value === CUSTOM_VALUE) {
    await interaction.showModal(customOrderModal());
    return;
  }

  if (!value.startsWith("meal:")) {
    await interaction.update(orderError("Unknown selection."));
    return;
  }

  const mealId = parseId(value.slice("meal:".length));
  const meal = mealId ? await ctx.meals.findById(mealId) : null;
  if (!meal || !meal.enabled) {
    await interaction.update(
      orderError("That meal is no longer available. Please pick another one."),
    );
    return;
  }

  await interaction.update(orderConfirmView(meal));
}

export async function placeMealOrder(
  ctx: BotContext,
  interaction: ButtonInteraction,
  mealId: number,
): Promise<void> {
  await interaction.deferUpdate();

  try {
    const order = await ctx.orders.createPredefined(
      actorOf(interaction.user),
      mealId,
      interaction.message?.id ?? null,
    );
    await interaction.editReply(confirmationView(order));
  } catch (error) {
    if (error instanceof ValidationError) {
      await interaction.editReply(orderError(error.message));
      return;
    }
    throw error;
  }
}

export async function submitCustomOrder(
  ctx: BotContext,
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const customText = interaction.fields.getTextInputValue(FIELD_ID);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const order = await ctx.orders.createCustom(
      actorOf(interaction.user),
      customText,
      interaction.id,
    );
    await interaction.editReply(confirmationView(order));
  } catch (error) {
    if (error instanceof ValidationError) {
      await interaction.editReply(orderError(error.message));
      return;
    }
    throw error;
  }
}

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
  type MessageActionRowComponentBuilder,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from "discord.js";
import type { Meal } from "../../db/schema.ts";
import { NotFoundError, ValidationError } from "../../domain/errors.ts";
import {
  MEAL_NAME_MAX_LENGTH,
  MEAL_RECIPE_MAX_LENGTH,
} from "../../services/meals.ts";
import { truncate } from "../../text.ts";
import type { BotContext } from "../context.ts";
import {
  backButton,
  COLORS,
  errorView,
  parseId,
} from "../ui.ts";

const NAME_FIELD_ID = "meal_name";
const RECIPE_FIELD_ID = "meal_recipe";
const ADD_MODAL_ID = "meals:add-modal";
const RENAME_MODAL_PREFIX = "meals:rename-modal:";
const RECIPE_MODAL_PREFIX = "meals:recipe-modal:";
const MAX_SELECT_OPTIONS = 25;

export function mealsListView(meals: Meal[]): BaseMessageOptions {
  const description =
    meals.length === 0
      ? "No meals yet. Add one to get started."
      : truncate(
          meals
            .map(
              (meal) =>
                `${meal.enabled ? "✅" : "⛔"} ${meal.name}${
                  meal.recipe ? " · 📝" : ""
                }`,
            )
            .join("\n"),
          3900,
        );

  const embed = new EmbedBuilder()
    .setTitle("📖 MEALS")
    .setColor(COLORS.brand)
    .setDescription(description);

  if (meals.length > MAX_SELECT_OPTIONS) {
    embed.setFooter({
      text: `Showing the first ${MAX_SELECT_OPTIONS} of ${meals.length} meals`,
    });
  }

  const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];

  if (meals.length > 0) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId("meals:select")
      .setPlaceholder("Manage a meal");

    for (const meal of meals.slice(0, MAX_SELECT_OPTIONS)) {
      menu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(truncate(meal.name, 100))
          .setDescription(
            `${meal.enabled ? "Enabled" : "Disabled"}${
              meal.recipe ? " · recipe" : ""
            }`,
          )
          .setValue(`meal:${meal.id}`),
      );
    }

    components.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
    );
  }

  components.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("meals:add")
        .setLabel("➕ Add meal")
        .setStyle(ButtonStyle.Success),
      backButton("home:menu"),
    ),
  );

  return { embeds: [embed], components, allowedMentions: { parse: [] } };
}

export function mealDetailView(meal: Meal): BaseMessageOptions {
  const summary = new EmbedBuilder()
    .setTitle(`📖 ${truncate(meal.name, 240)}`)
    .setColor(meal.enabled ? COLORS.success : COLORS.muted)
    .addFields({
      name: "Status",
      value: meal.enabled ? "✅ Enabled" : "⛔ Disabled",
      inline: true,
    });

  const recipe = new EmbedBuilder()
    .setTitle("📝 Recipe")
    .setColor(COLORS.muted)
    .setDescription(
      meal.recipe
        ? truncate(meal.recipe, MEAL_RECIPE_MAX_LENGTH)
        : "No recipe yet. Use **📝 Recipe** to add one.",
    );

  return {
    embeds: [summary, recipe],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`meals:rename:${meal.id}`)
          .setLabel("Rename")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`meals:recipe:${meal.id}`)
          .setLabel("📝 Recipe")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`meals:toggle:${meal.id}`)
          .setLabel(meal.enabled ? "Disable" : "Enable")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`meals:remove:${meal.id}`)
          .setLabel("Remove")
          .setStyle(ButtonStyle.Danger),
        backButton("meals:list"),
      ),
    ],
    allowedMentions: { parse: [] },
  };
}

function mealRemoveView(meal: Meal): BaseMessageOptions {
  const embed = new EmbedBuilder()
    .setTitle("Remove meal?")
    .setColor(COLORS.danger)
    .setDescription(
      `Remove **${truncate(meal.name, 200)}** permanently?\n\n` +
        "Meals that appear in order history cannot be removed. Disable them instead.",
    );

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`meals:remove-confirm:${meal.id}`)
          .setLabel("Remove permanently")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`meals:view:${meal.id}`)
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
    allowedMentions: { parse: [] },
  };
}

function nameInput(value?: string): TextInputBuilder {
  const input = new TextInputBuilder()
    .setCustomId(NAME_FIELD_ID)
    .setLabel("Meal name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(MEAL_NAME_MAX_LENGTH);

  if (value) input.setValue(value);
  return input;
}

function recipeInput(value?: string): TextInputBuilder {
  const input = new TextInputBuilder()
    .setCustomId(RECIPE_FIELD_ID)
    .setLabel("Recipe")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(MEAL_RECIPE_MAX_LENGTH)
    .setPlaceholder("Ingredients, quantities, and steps...");

  if (value) input.setValue(value);
  return input;
}

function mealNameModal(customId: string, title: string, value?: string) {
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput(value)),
    );
}

function addMealModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(ADD_MODAL_ID)
    .setTitle("➕ Add meal")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput()),
      new ActionRowBuilder<TextInputBuilder>().addComponents(recipeInput()),
    );
}

function recipeModal(customId: string, title: string, value?: string) {
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        recipeInput(value),
      ),
    );
}

function backToMeals(message: string): BaseMessageOptions {
  return errorView(message, [
    new ActionRowBuilder<ButtonBuilder>().addComponents(backButton("meals:list")),
  ]);
}

export async function openMeals(
  ctx: BotContext,
  interaction: ButtonInteraction,
): Promise<void> {
  const meals = await ctx.meals.listAll();
  await interaction.update(mealsListView(meals));
}

export async function openMealDetail(
  ctx: BotContext,
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  mealId: number,
): Promise<void> {
  const meal = await ctx.meals.findById(mealId);
  if (!meal) {
    await interaction.update(backToMeals("That meal no longer exists."));
    return;
  }
  await interaction.update(mealDetailView(meal));
}

export async function handleMealsSelect(
  ctx: BotContext,
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  const value = interaction.values[0];
  if (!value?.startsWith("meal:")) return;

  const mealId = parseId(value.slice("meal:".length));
  if (!mealId) return;

  await openMealDetail(ctx, interaction, mealId);
}

export async function openAddMealModal(
  interaction: ButtonInteraction,
): Promise<void> {
  await interaction.showModal(addMealModal());
}

export async function submitAddMeal(
  ctx: BotContext,
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const name = interaction.fields.getTextInputValue(NAME_FIELD_ID);
  const recipe = interaction.fields.getTextInputValue(RECIPE_FIELD_ID);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const meal = await ctx.meals.create(name, recipe);
    await interaction.editReply(mealDetailView(meal));
  } catch (error) {
    if (error instanceof ValidationError) {
      await interaction.editReply(backToMeals(error.message));
      return;
    }
    throw error;
  }
}

export async function openRenameMealModal(
  ctx: BotContext,
  interaction: ButtonInteraction,
  mealId: number,
): Promise<void> {
  const meal = await ctx.meals.findById(mealId);
  if (!meal) {
    await interaction.update(backToMeals("That meal no longer exists."));
    return;
  }

  await interaction.showModal(
    mealNameModal(
      `${RENAME_MODAL_PREFIX}${mealId}`,
      "Rename meal",
      meal.name,
    ),
  );
}

export async function submitRenameMeal(
  ctx: BotContext,
  interaction: ModalSubmitInteraction,
  mealId: number,
): Promise<void> {
  const name = interaction.fields.getTextInputValue(NAME_FIELD_ID);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const meal = await ctx.meals.rename(mealId, name);
    await interaction.editReply(mealDetailView(meal));
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      await interaction.editReply(backToMeals(error.message));
      return;
    }
    throw error;
  }
}

export async function openEditRecipeModal(
  ctx: BotContext,
  interaction: ButtonInteraction,
  mealId: number,
): Promise<void> {
  const meal = await ctx.meals.findById(mealId);
  if (!meal) {
    await interaction.update(backToMeals("That meal no longer exists."));
    return;
  }

  await interaction.showModal(
    recipeModal(
      `${RECIPE_MODAL_PREFIX}${mealId}`,
      "Edit recipe",
      meal.recipe ?? undefined,
    ),
  );
}

export async function submitEditRecipe(
  ctx: BotContext,
  interaction: ModalSubmitInteraction,
  mealId: number,
): Promise<void> {
  const recipe = interaction.fields.getTextInputValue(RECIPE_FIELD_ID);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const meal = await ctx.meals.setRecipe(mealId, recipe);
    await interaction.editReply(mealDetailView(meal));
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      await interaction.editReply(backToMeals(error.message));
      return;
    }
    throw error;
  }
}

export async function toggleMeal(
  ctx: BotContext,
  interaction: ButtonInteraction,
  mealId: number,
): Promise<void> {
  await interaction.deferUpdate();

  try {
    const meal = await ctx.meals.findById(mealId);
    if (!meal) throw new NotFoundError("Meal not found.");
    const updated = await ctx.meals.setEnabled(mealId, !meal.enabled);
    await interaction.editReply(mealDetailView(updated));
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      await interaction.editReply(backToMeals(error.message));
      return;
    }
    throw error;
  }
}

export async function openRemoveMeal(
  ctx: BotContext,
  interaction: ButtonInteraction,
  mealId: number,
): Promise<void> {
  const meal = await ctx.meals.findById(mealId);
  if (!meal) {
    await interaction.update(backToMeals("That meal no longer exists."));
    return;
  }
  await interaction.update(mealRemoveView(meal));
}

export async function confirmRemoveMeal(
  ctx: BotContext,
  interaction: ButtonInteraction,
  mealId: number,
): Promise<void> {
  await interaction.deferUpdate();

  try {
    await ctx.meals.remove(mealId);
    const meals = await ctx.meals.listAll();
    await interaction.editReply(mealsListView(meals));
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      await interaction.editReply(backToMeals(error.message));
      return;
    }
    throw error;
  }
}

import {
  MessageFlags,
  type ButtonInteraction,
  type Interaction,
  type InteractionReplyOptions,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from "discord.js";
import { isOrderAction } from "../domain/order-status.ts";
import { isAdmin, type BotContext } from "./context.ts";
import { homeView } from "./views/home.ts";
import { handleKitchenAction, openKitchen } from "./views/kitchen.ts";
import {
  confirmRemoveMeal,
  handleMealsSelect,
  openAddMealModal,
  openMealDetail,
  openMeals,
  openRemoveMeal,
  openRenameMealModal,
  submitAddMeal,
  submitRenameMeal,
  toggleMeal,
} from "./views/meals.ts";
import {
  handleMyOrdersSelect,
  openMyOrders,
  openOrderDetail,
} from "./views/my-orders.ts";
import { handleOrderDmAction } from "./views/order-dm.ts";
import {
  handleOrderSelect,
  openOrder,
  placeMealOrder,
  submitCustomOrder,
} from "./views/order.ts";
import { parseId, parsePage } from "./ui.ts";

function customIdOf(interaction: Interaction): string | undefined {
  return "customId" in interaction ? interaction.customId : undefined;
}

async function requireAdmin(
  ctx: BotContext,
  interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
): Promise<boolean> {
  if (isAdmin(ctx, interaction.user.id)) return true;

  const payload: InteractionReplyOptions = interaction.guildId
    ? {
        content: "You are not authorized to use this.",
        flags: "Ephemeral",
      }
    : { content: "You are not authorized to use this." };

  await interaction.reply(payload);
  return false;
}

async function respondWithError(interaction: Interaction): Promise<void> {
  if (!interaction.isRepliable()) return;

  const payload: InteractionReplyOptions = interaction.guildId
    ? {
        content: "Something went wrong. Please try again.",
        flags: "Ephemeral",
      }
    : { content: "Something went wrong. Please try again." };

  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch {
    // The interaction token may already be gone; nothing useful to do.
  }
}

async function routeButton(
  ctx: BotContext,
  interaction: ButtonInteraction,
): Promise<void> {
  const [scope, action, ...rest] = interaction.customId.split(":");

  switch (`${scope}:${action}`) {
    case "home:menu":
      await interaction.update(homeView(ctx, interaction.user.id));
      return;

    case "home:order":
      await openOrder(ctx, interaction);
      return;

    case "home:my-orders":
      await openMyOrders(ctx, interaction, 1);
      return;

    case "home:kitchen":
      if (await requireAdmin(ctx, interaction)) {
        await openKitchen(ctx, interaction, 1);
      }
      return;

    case "home:meals":
      if (await requireAdmin(ctx, interaction)) {
        await openMeals(ctx, interaction);
      }
      return;

    case "order:start":
      await openOrder(ctx, interaction);
      return;

    case "order:place": {
      const mealId = parseId(rest[0]);
      if (mealId) await placeMealOrder(ctx, interaction, mealId);
      return;
    }

    case "dm:advance": {
      if (!(await requireAdmin(ctx, interaction))) return;

      const orderId = parseId(rest[0]);
      const dmAction = rest[1];
      if (orderId && dmAction && isOrderAction(dmAction)) {
        await handleOrderDmAction(ctx, interaction, orderId, dmAction);
      }
      return;
    }

    case "orders:list":
      await openMyOrders(ctx, interaction, parsePage(rest[0]));
      return;

    case "kitchen:list":
      if (await requireAdmin(ctx, interaction)) {
        await openKitchen(ctx, interaction, parsePage(rest[0]));
      }
      return;

    case "kitchen:act": {
      if (!(await requireAdmin(ctx, interaction))) return;

      const orderId = parseId(rest[0]);
      const orderAction = rest[1];
      if (orderId && orderAction && isOrderAction(orderAction)) {
        await handleKitchenAction(
          ctx,
          interaction,
          orderId,
          orderAction,
          parsePage(rest[2]),
        );
      }
      return;
    }

    case "meals:list":
      if (await requireAdmin(ctx, interaction)) {
        await openMeals(ctx, interaction);
      }
      return;

    case "meals:add":
      if (await requireAdmin(ctx, interaction)) {
        await openAddMealModal(interaction);
      }
      return;

    case "meals:view": {
      if (!(await requireAdmin(ctx, interaction))) return;
      const mealId = parseId(rest[0]);
      if (mealId) await openMealDetail(ctx, interaction, mealId);
      return;
    }

    case "meals:rename": {
      if (!(await requireAdmin(ctx, interaction))) return;
      const mealId = parseId(rest[0]);
      if (mealId) await openRenameMealModal(ctx, interaction, mealId);
      return;
    }

    case "meals:toggle": {
      if (!(await requireAdmin(ctx, interaction))) return;
      const mealId = parseId(rest[0]);
      if (mealId) await toggleMeal(ctx, interaction, mealId);
      return;
    }

    case "meals:remove": {
      if (!(await requireAdmin(ctx, interaction))) return;
      const mealId = parseId(rest[0]);
      if (mealId) await openRemoveMeal(ctx, interaction, mealId);
      return;
    }

    case "meals:remove-confirm": {
      if (!(await requireAdmin(ctx, interaction))) return;
      const mealId = parseId(rest[0]);
      if (mealId) await confirmRemoveMeal(ctx, interaction, mealId);
      return;
    }

    default:
      ctx.logger.warn("Unhandled button interaction", {
        customId: interaction.customId,
      });
  }
}

async function routeSelect(
  ctx: BotContext,
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  const [scope, action, ...rest] = interaction.customId.split(":");

  switch (`${scope}:${action}`) {
    case "order:select":
      await handleOrderSelect(ctx, interaction);
      return;

    case "orders:select":
      await handleMyOrdersSelect(ctx, interaction, parsePage(rest[0]));
      return;

    case "meals:select":
      if (await requireAdmin(ctx, interaction)) {
        await handleMealsSelect(ctx, interaction);
      }
      return;

    default:
      ctx.logger.warn("Unhandled select interaction", {
        customId: interaction.customId,
      });
  }
}

async function routeModal(
  ctx: BotContext,
  interaction: ModalSubmitInteraction,
): Promise<void> {
  if (interaction.customId === "order:custom-modal") {
    await submitCustomOrder(ctx, interaction);
    return;
  }

  if (interaction.customId === "meals:add-modal") {
    if (await requireAdmin(ctx, interaction)) {
      await submitAddMeal(ctx, interaction);
    }
    return;
  }

  if (interaction.customId.startsWith("meals:rename-modal:")) {
    if (!(await requireAdmin(ctx, interaction))) return;
    const mealId = parseId(interaction.customId.split(":")[2]);
    if (mealId) await submitRenameMeal(ctx, interaction, mealId);
    return;
  }

  ctx.logger.warn("Unhandled modal interaction", {
    customId: interaction.customId,
  });
}

export function createInteractionHandler(
  ctx: BotContext,
): (interaction: Interaction) => Promise<void> {
  return async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        if (interaction.commandName === "menu") {
          await interaction.reply({
            ...homeView(ctx, interaction.user.id),
            flags: MessageFlags.Ephemeral,
          });
        }
        return;
      }

      if (interaction.isButton()) {
        await routeButton(ctx, interaction);
        return;
      }

      if (interaction.isStringSelectMenu()) {
        await routeSelect(ctx, interaction);
        return;
      }

      if (interaction.isModalSubmit()) {
        await routeModal(ctx, interaction);
        return;
      }
    } catch (error) {
      ctx.logger.error("Interaction failed", {
        customId: customIdOf(interaction),
        userId: interaction.user?.id,
        error,
      });
      await respondWithError(interaction);
    }
  };
}

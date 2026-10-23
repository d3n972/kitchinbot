import { describe, expect, test } from "bun:test";
import { ActionRowBuilder, type ButtonBuilder } from "discord.js";
import { kitchenView } from "../src/discord/views/kitchen.ts";
import type { OrderWithUser } from "../src/services/repositories.ts";

function order(overrides: Partial<OrderWithUser> = {}): OrderWithUser {
  return {
    id: 1042,
    userId: 1,
    status: "ORDERED",
    mealId: 1,
    mealName: "Chicken Curry",
    mealRecipe: "Simmer the sauce, then add the chicken.",
    customText: null,
    idempotencyKey: null,
    createdAt: new Date("2026-01-01T12:00:00Z"),
    updatedAt: new Date("2026-01-01T12:00:00Z"),
    userDisplayName: "Mark",
    userDiscordId: "111111111111111111",
    ...overrides,
  };
}

function buttonIds(view: ReturnType<typeof kitchenView>): string[] {
  const rows = (view.components ?? []) as unknown as ActionRowBuilder<ButtonBuilder>[];
  return rows
    .flatMap((row) => row.toJSON().components)
    .flatMap((component) =>
      "custom_id" in component && component.custom_id
        ? [component.custom_id]
        : [],
    );
}

describe("kitchen order cards", () => {
  test("offer the captured recipe alongside the next action", () => {
    const ids = buttonIds(
      kitchenView({
        items: [order()],
        page: 1,
        pageCount: 1,
        total: 1,
      }),
    );

    expect(ids).toContain("kitchen:act:1042:prepare:1");
    expect(ids).toContain("kitchen:recipe:1042");
    expect(ids).toContain("kitchen:act:1042:cancel:1");
  });

  test("hide the recipe button when the order has none", () => {
    const ids = buttonIds(
      kitchenView({
        items: [
          order({
            mealId: null,
            mealName: null,
            mealRecipe: null,
            customText: "One omurice",
          }),
        ],
        page: 1,
        pageCount: 1,
        total: 1,
      }),
    );

    expect(ids).not.toContain("kitchen:recipe:1042");
  });
});

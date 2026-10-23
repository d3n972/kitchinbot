import { describe, expect, test } from "bun:test";
import {
  ActionRowBuilder,
  type ButtonBuilder,
  type EmbedBuilder,
} from "discord.js";
import type { Meal } from "../src/db/schema.ts";
import { mealDetailView } from "../src/discord/views/meals.ts";

function meal(overrides: Partial<Meal> = {}): Meal {
  return {
    id: 1,
    name: "Chicken Curry",
    recipe: null,
    enabled: true,
    createdAt: new Date("2026-01-01T12:00:00Z"),
    updatedAt: new Date("2026-01-01T12:00:00Z"),
    ...overrides,
  };
}

function buttonIds(view: ReturnType<typeof mealDetailView>): string[] {
  const rows = (view.components ?? []) as unknown as ActionRowBuilder<ButtonBuilder>[];
  return rows
    .flatMap((row) => row.toJSON().components)
    .flatMap((component) =>
      "custom_id" in component && component.custom_id
        ? [component.custom_id]
        : [],
    );
}

describe("meal detail view", () => {
  test("shows the recipe and an edit button", () => {
    const view = mealDetailView(
      meal({ recipe: "Simmer the sauce, then add the chicken." }),
    );
    const embeds = view.embeds as EmbedBuilder[];

    expect(embeds).toHaveLength(2);
    expect(embeds[1]!.toJSON().title).toBe("📝 Recipe");
    expect(embeds[1]!.toJSON().description).toBe(
      "Simmer the sauce, then add the chicken.",
    );
    expect(buttonIds(view)).toContain("meals:recipe:1");
  });

  test("prompts for a recipe when none is stored", () => {
    const view = mealDetailView(meal());
    const embeds = view.embeds as EmbedBuilder[];

    expect(embeds[1]!.toJSON().description).toContain("No recipe yet");
    expect(buttonIds(view)).toContain("meals:recipe:1");
  });
});

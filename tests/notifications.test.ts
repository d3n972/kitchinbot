import { describe, expect, test } from "bun:test";
import type { EmbedBuilder } from "discord.js";
import {
  buildDmDescription,
  buildNtfyMessage,
} from "../src/notifications/format.ts";
import type { OrderWithUser } from "../src/services/repositories.ts";
import { confirmationView } from "../src/discord/ui.ts";

function order(overrides: Partial<OrderWithUser> = {}): OrderWithUser {
  return {
    id: 1042,
    userId: 1,
    status: "ORDERED",
    mealId: 1,
    mealName: "Chicken Curry",
    mealRecipe: null,
    customText: null,
    idempotencyKey: null,
    createdAt: new Date("2026-01-01T12:00:00Z"),
    updatedAt: new Date("2026-01-01T12:00:00Z"),
    userDisplayName: "Mark",
    userDiscordId: "111111111111111111",
    ...overrides,
  };
}

describe("notification formatting", () => {
  test("formats a predefined ntfy message", () => {
    expect(buildNtfyMessage(order())).toBe(
      "New food order from Mark\n\nChicken Curry\n\nOrder #1042",
    );
  });

  test("formats a custom ntfy message verbatim", () => {
    const text = "2 chicken curry, one without onions and an omurice";
    expect(
      buildNtfyMessage(
        order({ mealId: null, mealName: null, customText: text }),
      ),
    ).toBe(
      `New food order from Mark\n\nCustom:\n${text}\n\nOrder #1042`,
    );
  });

  test("formats the Discord DM description", () => {
    expect(buildDmDescription(order())).toBe(
      "From: Mark\n\nChicken Curry\n\nOrder #1042",
    );

    expect(
      buildDmDescription(
        order({
          id: 1043,
          mealId: null,
          mealName: null,
          customText: "Omurice",
        }),
      ),
    ).toBe("From: Mark\n\nCustom order:\nOmurice\n\nOrder #1043");
  });

  test("confirmation mirrors the persisted order", () => {
    const view = confirmationView(order());
    const embed = (view.embeds as EmbedBuilder[])[0]!;
    const json = embed.toJSON();

    expect(json.title).toBe("✅ Order placed");
    expect(json.description).toContain("Chicken Curry");
    expect(json.description).toContain("Order #1042");
    expect(json.description).toContain("Status: ORDERED");
  });

  test("custom confirmation shows the exact stored text", () => {
    const text = "  2 curry, no onions  ";
    const view = confirmationView(
      order({ mealId: null, mealName: null, customText: text }),
    );
    const embed = (view.embeds as EmbedBuilder[])[0]!;

    expect(embed.toJSON().description).toContain(text);
  });
});

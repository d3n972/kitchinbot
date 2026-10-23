import { describe, expect, test } from "bun:test";
import {
  ActionRowBuilder,
  ButtonStyle,
  type ButtonBuilder,
  type EmbedBuilder,
} from "discord.js";
import { orderDmView } from "../src/discord/views/order-dm.ts";
import type { OrderWithUser } from "../src/services/repositories.ts";

function order(overrides: Partial<OrderWithUser> = {}): OrderWithUser {
  return {
    id: 1042,
    userId: 1,
    status: "ORDERED",
    mealId: 1,
    mealName: "Chicken Curry",
    customText: null,
    idempotencyKey: null,
    createdAt: new Date("2026-01-01T12:00:00Z"),
    updatedAt: new Date("2026-01-01T12:00:00Z"),
    userDisplayName: "Mark",
    userDiscordId: "111111111111111111",
    ...overrides,
  };
}

function buttons(view: ReturnType<typeof orderDmView>) {
  const rows = (view.components ?? []) as unknown as ActionRowBuilder<ButtonBuilder>[];
  return rows
    .flatMap((row) => row.toJSON().components)
    .map((component) => ({
      customId: "custom_id" in component ? component.custom_id : undefined,
      label: "label" in component ? component.label : undefined,
      style: "style" in component ? component.style : undefined,
    }));
}

function description(view: ReturnType<typeof orderDmView>): string {
  const embed = (view.embeds as EmbedBuilder[])[0]!;
  return embed.toJSON().description ?? "";
}

describe("order notification DM", () => {
  test("offers Prepare while the order is ORDERED", () => {
    const view = orderDmView(order());

    expect(buttons(view)).toEqual([
      {
        customId: "dm:advance:1042:prepare",
        label: "Start Preparing",
        style: ButtonStyle.Primary,
      },
    ]);
    expect(description(view)).toContain("Chicken Curry");
    expect(description(view)).toContain("Order #1042");
    expect(description(view)).toContain("Status: ⚪ ORDERED");
  });

  test("offers Mark Ready while PREPARING", () => {
    const view = orderDmView(order({ status: "PREPARING" }));

    expect(buttons(view)).toEqual([
      {
        customId: "dm:advance:1042:ready",
        label: "Mark Ready",
        style: ButtonStyle.Primary,
      },
    ]);
    expect(description(view)).toContain("Status: 🟠 PREPARING");
  });

  test("offers Done when the order is READY", () => {
    const view = orderDmView(order({ status: "READY" }));

    expect(buttons(view)).toEqual([
      {
        customId: "dm:advance:1042:complete",
        label: "Done",
        style: ButtonStyle.Success,
      },
    ]);
    expect(description(view)).toContain("Status: 🟢 READY");
  });

  test("removes buttons once the order is finished", () => {
    expect(buttons(orderDmView(order({ status: "COMPLETED" })))).toEqual([]);
    expect(buttons(orderDmView(order({ status: "CANCELLED" })))).toEqual([]);
  });

  test("shows custom text verbatim above the status", () => {
    const text = "  2 curry, one without onions  ";
    const view = orderDmView(
      order({ mealId: null, mealName: null, customText: text }),
    );

    expect(description(view)).toContain(text);
    expect(description(view)).toContain("Order #1042");
  });
});

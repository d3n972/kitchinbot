import { truncate } from "../text.ts";

/** The ordered content for display; storage is never modified. */
export function orderContent(order: {
  mealName: string | null;
  customText: string | null;
}): string {
  return order.mealName ?? order.customText ?? "";
}

export function buildNtfyMessage(order: {
  id: number;
  userDisplayName: string;
  mealName: string | null;
  customText: string | null;
}): string {
  const content = order.mealName
    ? order.mealName
    : `Custom:\n${order.customText ?? ""}`;

  return [
    `New food order from ${order.userDisplayName}`,
    "",
    content,
    "",
    `Order #${order.id}`,
  ].join("\n");
}

export function buildDmDescription(order: {
  id: number;
  userDisplayName: string;
  mealName: string | null;
  customText: string | null;
}): string {
  const content = order.mealName
    ? order.mealName
    : `Custom order:\n${truncate(order.customText ?? "", 3600)}`;

  return [
    `From: ${order.userDisplayName}`,
    "",
    content,
    "",
    `Order #${order.id}`,
  ].join("\n");
}

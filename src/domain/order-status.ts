import type { OrderStatus } from "../db/schema.ts";

export const ORDER_ACTIONS = [
  "prepare",
  "ready",
  "complete",
  "cancel",
] as const;

export type OrderAction = (typeof ORDER_ACTIONS)[number];

const TRANSITIONS: Record<
  OrderStatus,
  Partial<Record<OrderAction, OrderStatus>>
> = {
  ORDERED: { prepare: "PREPARING", cancel: "CANCELLED" },
  PREPARING: { ready: "READY", cancel: "CANCELLED" },
  READY: { complete: "COMPLETED" },
  COMPLETED: {},
  CANCELLED: {},
};

export const ACTIVE_STATUSES: OrderStatus[] = [
  "ORDERED",
  "PREPARING",
  "READY",
];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  ORDERED: "⚪ ORDERED",
  PREPARING: "🟠 PREPARING",
  READY: "🟢 READY",
  COMPLETED: "✅ COMPLETED",
  CANCELLED: "⛔ CANCELLED",
};

export const ACTION_LABELS: Record<OrderAction, string> = {
  prepare: "Start Preparing",
  ready: "Mark Ready",
  complete: "Complete",
  cancel: "Cancel",
};

export function nextStatus(
  current: OrderStatus,
  action: OrderAction,
): OrderStatus | null {
  return TRANSITIONS[current][action] ?? null;
}

export function availableActions(current: OrderStatus): OrderAction[] {
  return ORDER_ACTIONS.filter((action) => TRANSITIONS[current][action]);
}

export function isOrderStatus(value: string): value is OrderStatus {
  return Object.hasOwn(TRANSITIONS, value);
}

export function isOrderAction(value: string): value is OrderAction {
  return (ORDER_ACTIONS as readonly string[]).includes(value);
}

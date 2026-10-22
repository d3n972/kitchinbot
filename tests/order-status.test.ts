import { describe, expect, test } from "bun:test";
import type { OrderStatus } from "../src/db/schema.ts";
import {
  ACTIVE_STATUSES,
  availableActions,
  nextStatus,
  type OrderAction,
} from "../src/domain/order-status.ts";

const EXPECTED: Record<
  OrderStatus,
  Partial<Record<OrderAction, OrderStatus>>
> = {
  ORDERED: { prepare: "PREPARING", cancel: "CANCELLED" },
  PREPARING: { ready: "READY", cancel: "CANCELLED" },
  READY: { complete: "COMPLETED" },
  COMPLETED: {},
  CANCELLED: {},
};

const ACTIONS: OrderAction[] = ["prepare", "ready", "complete", "cancel"];

describe("order status transitions", () => {
  for (const status of Object.keys(EXPECTED) as OrderStatus[]) {
    for (const action of ACTIONS) {
      const target = EXPECTED[status][action];
      test(`${status} + ${action} -> ${target ?? "rejected"}`, () => {
        expect(nextStatus(status, action)).toBe(target ?? null);
      });
    }
  }

  test("terminal states have no available actions", () => {
    expect(availableActions("COMPLETED")).toEqual([]);
    expect(availableActions("CANCELLED")).toEqual([]);
  });

  test("active statuses are the three pre-completion states", () => {
    expect(ACTIVE_STATUSES).toEqual(["ORDERED", "PREPARING", "READY"]);
  });
});

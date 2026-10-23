import { beforeEach, describe, expect, test } from "bun:test";
import {
  ConflictError,
  InvalidTransitionError,
  NotFoundError,
  ValidationError,
} from "../src/domain/errors.ts";
import {
  createOrderService,
  type OrderActor,
  type OrderService,
} from "../src/services/orders.ts";
import type { OrderWithUser } from "../src/services/repositories.ts";
import { createFakes, silentLogger, type FakeRepositories } from "./fakes.ts";

const mark: OrderActor = {
  discordId: "111111111111111111",
  displayName: "Mark",
};

const anna: OrderActor = {
  discordId: "222222222222222222",
  displayName: "Anna",
};

describe("order service", () => {
  let fakes: FakeRepositories;
  let service: OrderService;

  beforeEach(() => {
    fakes = createFakes();
    service = createOrderService({
      orders: fakes.orders,
      users: fakes.users,
      meals: fakes.meals,
      notifier: fakes.notifier,
      logger: silentLogger,
    });
  });

  async function seedMeal(name = "Chicken Curry"): Promise<number> {
    const meal = await fakes.meals.create(name);
    return meal.id;
  }

  test("creates a predefined order with a meal snapshot", async () => {
    const mealId = await seedMeal();

    const order = await service.createPredefined(mark, mealId, null);

    expect(order.id).toBe(1001);
    expect(order.status).toBe("ORDERED");
    expect(order.mealId).toBe(mealId);
    expect(order.mealName).toBe("Chicken Curry");
    expect(order.customText).toBeNull();
    expect(order.userDisplayName).toBe("Mark");
    expect(order.userDiscordId).toBe(mark.discordId);
    expect(fakes.store.orders).toHaveLength(1);
    expect(fakes.notified).toHaveLength(1);
  });

  test("keeps the meal name snapshot after the catalogue is renamed", async () => {
    const mealId = await seedMeal();
    const order = await service.createPredefined(mark, mealId, null);

    await fakes.meals.rename(mealId, "Chicken Katsu");

    const reloaded = await service.getById(order.id);
    expect(reloaded.mealName).toBe("Chicken Curry");
  });

  test("snapshots the meal recipe on the order", async () => {
    const meal = await fakes.meals.create(
      "Chicken Curry",
      "Simmer the sauce, then add the chicken.",
    );

    const order = await service.createPredefined(mark, meal.id, null);
    expect(order.mealRecipe).toBe(
      "Simmer the sauce, then add the chicken.",
    );

    await fakes.meals.setRecipe(meal.id, "A different recipe");

    const reloaded = await service.getById(order.id);
    expect(reloaded.mealRecipe).toBe(
      "Simmer the sauce, then add the chicken.",
    );
  });

  test("custom orders do not carry a recipe", async () => {
    const order = await service.createCustom(mark, "One omurice", null);
    expect(order.mealRecipe).toBeNull();
  });

  test("stores custom text verbatim", async () => {
    const raw = "  2 chicken curry, one without onions\nand an omurice  ";

    const order = await service.createCustom(mark, raw, null);

    expect(order.customText).toBe(raw);
    expect(order.mealId).toBeNull();
    expect(order.mealName).toBeNull();
    expect(fakes.notified).toHaveLength(1);
  });

  test("rejects a whitespace-only custom order", async () => {
    await expect(service.createCustom(mark, "  \n\t ", null)).rejects.toThrow(
      ValidationError,
    );
    expect(fakes.store.orders).toHaveLength(0);
    expect(fakes.notified).toHaveLength(0);
  });

  test("rejects a custom order over the length limit", async () => {
    await expect(
      service.createCustom(mark, "x".repeat(4001), null),
    ).rejects.toThrow(ValidationError);
    expect(fakes.store.orders).toHaveLength(0);
  });

  test("rejects unknown and disabled meals", async () => {
    await expect(service.createPredefined(mark, 999, null)).rejects.toThrow(
      ValidationError,
    );

    const mealId = await seedMeal();
    await fakes.meals.setEnabled(mealId, false);

    await expect(
      service.createPredefined(mark, mealId, null),
    ).rejects.toThrow(ValidationError);

    expect(fakes.store.orders).toHaveLength(0);
  });

  test("deduplicates repeated submissions by idempotency key", async () => {
    const mealId = await seedMeal();

    const first = await service.createPredefined(mark, mealId, "message-1");
    const second = await service.createPredefined(mark, mealId, "message-1");

    expect(second.id).toBe(first.id);
    expect(fakes.store.orders).toHaveLength(1);
    expect(fakes.notified).toHaveLength(1);
  });

  test("recovers from a concurrent idempotency collision", async () => {
    const mealId = await seedMeal();

    // Simulate a race: the pre-check misses, the insert hits the unique
    // constraint, and the retry lookup finds the winner's row.
    let lookups = 0;
    const racingOrders = {
      ...fakes.orders,
      async findByIdempotencyKey(key: string) {
        lookups += 1;
        if (lookups === 1) return null;
        return fakes.orders.findByIdempotencyKey(key);
      },
    };

    const racingService = createOrderService({
      orders: racingOrders,
      users: fakes.users,
      meals: fakes.meals,
      notifier: fakes.notifier,
      logger: silentLogger,
    });

    const existing = await service.createPredefined(mark, mealId, "race-key");

    const result = await racingService.createPredefined(
      mark,
      mealId,
      "race-key",
    );

    expect(result.id).toBe(existing.id);
    expect(fakes.store.orders).toHaveLength(1);
    expect(fakes.notified).toHaveLength(1);
  });

  test("scopes order history to the requesting user", async () => {
    const mealId = await seedMeal();
    await service.createPredefined(mark, mealId, null);
    await service.createPredefined(anna, mealId, null);

    const markOrders = await service.listForActor(mark, 1);
    const annaOrders = await service.listForActor(anna, 1);

    expect(markOrders.total).toBe(1);
    expect(markOrders.items[0]?.userDisplayName).toBe("Mark");
    expect(annaOrders.total).toBe(1);
    expect(annaOrders.items[0]?.userDisplayName).toBe("Anna");
  });

  test("returns an empty history for a user who has never ordered", async () => {
    const page = await service.listForActor(anna, 1);
    expect(page).toEqual({
      items: [],
      page: 1,
      pageCount: 1,
      total: 0,
    });
  });

  test("prevents users from viewing another user's order", async () => {
    const mealId = await seedMeal();
    const order = await service.createPredefined(mark, mealId, null);

    await expect(service.getForActor(order.id, anna)).rejects.toThrow(
      NotFoundError,
    );
    await expect(service.getForActor(order.id, mark)).resolves.toMatchObject({
      id: order.id,
    });
  });

  test("walks the full preparation lifecycle", async () => {
    const mealId = await seedMeal();
    const order = await service.createPredefined(mark, mealId, null);

    expect((await service.advance(order.id, "prepare")).status).toBe(
      "PREPARING",
    );
    expect((await service.advance(order.id, "ready")).status).toBe("READY");
    expect((await service.advance(order.id, "complete")).status).toBe(
      "COMPLETED",
    );
  });

  test("rejects invalid transitions", async () => {
    const mealId = await seedMeal();
    const order = await service.createPredefined(mark, mealId, null);

    await expect(service.advance(order.id, "complete")).rejects.toThrow(
      InvalidTransitionError,
    );
    await expect(service.advance(order.id, "ready")).rejects.toThrow(
      InvalidTransitionError,
    );
    expect((await service.getById(order.id)).status).toBe("ORDERED");
  });

  test("allows cancellation only before preparation is complete", async () => {
    const mealId = await seedMeal();
    const first = await service.createPredefined(mark, mealId, null);
    const second = await service.createPredefined(mark, mealId, null);

    await service.advance(first.id, "cancel");
    await service.advance(second.id, "prepare");
    await service.advance(second.id, "cancel");

    expect((await service.getById(first.id)).status).toBe("CANCELLED");
    expect((await service.getById(second.id)).status).toBe("CANCELLED");

    const third = await service.createPredefined(mark, mealId, null);
    await service.advance(third.id, "prepare");
    await service.advance(third.id, "ready");

    await expect(service.advance(third.id, "cancel")).rejects.toThrow(
      InvalidTransitionError,
    );
  });

  test("reports a conflict when another writer advanced the order", async () => {
    const mealId = await seedMeal();
    const order = await service.createPredefined(mark, mealId, null);

    await fakes.orders.transition(order.id, "ORDERED", "PREPARING");

    // Present a stale status so the conditional update loses the race.
    const staleOrders = {
      ...fakes.orders,
      async findStatus() {
        return "ORDERED" as const;
      },
    };
    const staleService = createOrderService({
      orders: staleOrders,
      users: fakes.users,
      meals: fakes.meals,
      notifier: fakes.notifier,
      logger: silentLogger,
    });

    await expect(staleService.advance(order.id, "prepare")).rejects.toThrow(
      ConflictError,
    );
  });

  test("kitchen view lists active orders oldest first, four per page", async () => {
    const mealId = await seedMeal();
    const orders: OrderWithUser[] = [];
    for (let index = 0; index < 5; index++) {
      orders.push(await service.createPredefined(mark, mealId, null));
    }

    const firstPage = await service.listKitchen(1);
    expect(firstPage.total).toBe(5);
    expect(firstPage.pageCount).toBe(2);
    expect(firstPage.items.map((order) => order.id)).toEqual(
      orders.slice(0, 4).map((order) => order.id),
    );

    const secondPage = await service.listKitchen(2);
    expect(secondPage.items.map((order) => order.id)).toEqual([
      orders[4]!.id,
    ]);

    await service.advance(orders[0]!.id, "prepare");
    await service.advance(orders[0]!.id, "ready");
    await service.advance(orders[0]!.id, "complete");

    const afterCompletion = await service.listKitchen(1);
    expect(afterCompletion.total).toBe(4);
    expect(afterCompletion.items.map((order) => order.id)).not.toContain(
      orders[0]?.id,
    );
  });
});

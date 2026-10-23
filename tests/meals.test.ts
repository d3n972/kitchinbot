import { beforeEach, describe, expect, test } from "bun:test";
import { NotFoundError, ValidationError } from "../src/domain/errors.ts";
import { createMealService, type MealService } from "../src/services/meals.ts";
import { createOrderService } from "../src/services/orders.ts";
import { createFakes, silentLogger, type FakeRepositories } from "./fakes.ts";

const mark = {
  discordId: "111111111111111111",
  displayName: "Mark",
};

describe("meal service", () => {
  let fakes: FakeRepositories;
  let meals: MealService;

  beforeEach(() => {
    fakes = createFakes();
    meals = createMealService(fakes.meals);
  });

  test("creates a meal with trimmed catalogue name", async () => {
    const meal = await meals.create("  Chicken Curry  ");
    expect(meal.name).toBe("Chicken Curry");
    expect(meal.recipe).toBeNull();
    expect(meal.enabled).toBe(true);
  });

  test("stores an optional recipe and can replace or clear it", async () => {
    const meal = await meals.create(
      "Chicken Curry",
      "  Simmer the sauce.\nAdd chicken.  ",
    );
    expect(meal.recipe).toBe("Simmer the sauce.\nAdd chicken.");

    const updated = await meals.setRecipe(meal.id, "New recipe");
    expect(updated.recipe).toBe("New recipe");

    const cleared = await meals.setRecipe(meal.id, "   ");
    expect(cleared.recipe).toBeNull();
  });

  test("rejects an oversized recipe", async () => {
    await expect(
      meals.create("Chicken Curry", "x".repeat(4001)),
    ).rejects.toThrow(ValidationError);
  });

  test("rejects empty and oversized names", async () => {
    await expect(meals.create("   ")).rejects.toThrow(ValidationError);
    await expect(meals.create("x".repeat(81))).rejects.toThrow(
      ValidationError,
    );
  });

  test("renames and toggles a meal", async () => {
    const meal = await meals.create("Curry");

    expect((await meals.rename(meal.id, "Katsu Curry")).name).toBe(
      "Katsu Curry",
    );

    const disabled = await meals.setEnabled(meal.id, false);
    expect(disabled.enabled).toBe(false);
    expect(await meals.listEnabled()).toHaveLength(0);
    expect(await meals.listAll()).toHaveLength(1);

    await expect(meals.rename(999, "Ghost")).rejects.toThrow(NotFoundError);
    await expect(meals.setEnabled(999, true)).rejects.toThrow(NotFoundError);
  });

  test("removes a meal that has never been ordered", async () => {
    const meal = await meals.create("Curry");
    await meals.remove(meal.id);
    expect(await meals.listAll()).toHaveLength(0);
  });

  test("refuses to remove a meal referenced by order history", async () => {
    const meal = await meals.create("Curry");
    const orders = createOrderService({
      orders: fakes.orders,
      users: fakes.users,
      meals: fakes.meals,
      notifier: fakes.notifier,
      logger: silentLogger,
    });
    await orders.createPredefined(mark, meal.id, null);

    await expect(meals.remove(meal.id)).rejects.toThrow(ValidationError);
    expect(await meals.listAll()).toHaveLength(1);

    await meals.setEnabled(meal.id, false);
    expect((await meals.listAll())[0]?.enabled).toBe(false);
  });
});

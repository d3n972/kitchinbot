import { NotFoundError, ValidationError } from "../domain/errors.ts";
import type { Meal } from "../db/schema.ts";
import type { MealRepository } from "./repositories.ts";

export const MEAL_NAME_MAX_LENGTH = 80;

export interface MealService {
  listEnabled(): Promise<Meal[]>;
  listAll(): Promise<Meal[]>;
  findById(mealId: number): Promise<Meal | null>;
  create(rawName: string): Promise<Meal>;
  rename(mealId: number, rawName: string): Promise<Meal>;
  setEnabled(mealId: number, enabled: boolean): Promise<Meal>;
  remove(mealId: number): Promise<void>;
}

function normalizeMealName(rawName: string): string {
  const name = rawName.trim();
  if (!name) throw new ValidationError("Please enter a meal name.");
  if (name.length > MEAL_NAME_MAX_LENGTH) {
    throw new ValidationError(
      `Meal names can be at most ${MEAL_NAME_MAX_LENGTH} characters.`,
    );
  }
  return name;
}

export function createMealService(meals: MealRepository): MealService {
  return {
    listEnabled: () => meals.listEnabled(),
    listAll: () => meals.listAll(),
    findById: (mealId) => meals.findById(mealId),

    create: async (rawName) => meals.create(normalizeMealName(rawName)),

    async rename(mealId, rawName) {
      const meal = await meals.rename(mealId, normalizeMealName(rawName));
      if (!meal) throw new NotFoundError("Meal not found.");
      return meal;
    },

    async setEnabled(mealId, enabled) {
      const meal = await meals.setEnabled(mealId, enabled);
      if (!meal) throw new NotFoundError("Meal not found.");
      return meal;
    },

    async remove(mealId) {
      const meal = await meals.findById(mealId);
      if (!meal) throw new NotFoundError("Meal not found.");

      const orderCount = await meals.countOrdersForMeal(mealId);
      if (orderCount > 0) {
        throw new ValidationError(
          "This meal appears in order history, so it cannot be removed. Disable it instead.",
        );
      }

      const deleted = await meals.delete(mealId);
      if (!deleted) throw new NotFoundError("Meal not found.");
    },
  };
}

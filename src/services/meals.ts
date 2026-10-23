import { NotFoundError, ValidationError } from "../domain/errors.ts";
import type { Meal } from "../db/schema.ts";
import type { MealRepository } from "./repositories.ts";

export const MEAL_NAME_MAX_LENGTH = 80;
export const MEAL_RECIPE_MAX_LENGTH = 4000;

export interface MealService {
  listEnabled(): Promise<Meal[]>;
  listAll(): Promise<Meal[]>;
  findById(mealId: number): Promise<Meal | null>;
  create(rawName: string, rawRecipe?: string): Promise<Meal>;
  rename(mealId: number, rawName: string): Promise<Meal>;
  setRecipe(mealId: number, rawRecipe: string): Promise<Meal>;
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

function normalizeRecipe(
  rawRecipe: string | null | undefined,
): string | null {
  if (rawRecipe == null) return null;

  const recipe = rawRecipe.trim();
  if (!recipe) return null;
  if (recipe.length > MEAL_RECIPE_MAX_LENGTH) {
    throw new ValidationError(
      `Recipes can be at most ${MEAL_RECIPE_MAX_LENGTH} characters.`,
    );
  }
  return recipe;
}

export function createMealService(meals: MealRepository): MealService {
  return {
    listEnabled: () => meals.listEnabled(),
    listAll: () => meals.listAll(),
    findById: (mealId) => meals.findById(mealId),

    create: async (rawName, rawRecipe) =>
      meals.create(normalizeMealName(rawName), normalizeRecipe(rawRecipe)),

    async rename(mealId, rawName) {
      const meal = await meals.rename(mealId, normalizeMealName(rawName));
      if (!meal) throw new NotFoundError("Meal not found.");
      return meal;
    },

    async setRecipe(mealId, rawRecipe) {
      const meal = await meals.setRecipe(
        mealId,
        normalizeRecipe(rawRecipe),
      );
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

import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import type { Database } from "./client.ts";
import { meals, orders, users } from "./schema.ts";
import type {
  CreateOrderRecord,
  MealRepository,
  OrderRepository,
  OrderWithUser,
  UserRepository,
} from "../services/repositories.ts";
import type { OrderStatus } from "./schema.ts";

function withUser(
  order: typeof orders.$inferSelect,
  userDisplayName: string,
  userDiscordId: string,
): OrderWithUser {
  return { ...order, userDisplayName, userDiscordId };
}

export function createUserRepository(db: Database): UserRepository {
  return {
    async upsert(discordId, displayName) {
      const [row] = await db
        .insert(users)
        .values({ discordId, displayName })
        .onConflictDoUpdate({
          target: users.discordId,
          set: { displayName, updatedAt: new Date() },
        })
        .returning();
      if (!row) throw new Error("Failed to upsert user");
      return row;
    },

    async findById(id) {
      const [row] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      return row ?? null;
    },

    async findByDiscordId(discordId) {
      const [row] = await db
        .select()
        .from(users)
        .where(eq(users.discordId, discordId))
        .limit(1);
      return row ?? null;
    },
  };
}

export function createMealRepository(db: Database): MealRepository {
  return {
    async listEnabled() {
      return db
        .select()
        .from(meals)
        .where(eq(meals.enabled, true))
        .orderBy(asc(meals.name));
    },

    async listAll() {
      return db.select().from(meals).orderBy(asc(meals.name));
    },

    async findById(id) {
      const [row] = await db
        .select()
        .from(meals)
        .where(eq(meals.id, id))
        .limit(1);
      return row ?? null;
    },

    async create(name, recipe = null) {
      const [row] = await db.insert(meals).values({ name, recipe }).returning();
      if (!row) throw new Error("Failed to create meal");
      return row;
    },

    async rename(id, name) {
      const [row] = await db
        .update(meals)
        .set({ name, updatedAt: new Date() })
        .where(eq(meals.id, id))
        .returning();
      return row ?? null;
    },

    async setRecipe(id, recipe) {
      const [row] = await db
        .update(meals)
        .set({ recipe, updatedAt: new Date() })
        .where(eq(meals.id, id))
        .returning();
      return row ?? null;
    },

    async setEnabled(id, enabled) {
      const [row] = await db
        .update(meals)
        .set({ enabled, updatedAt: new Date() })
        .where(eq(meals.id, id))
        .returning();
      return row ?? null;
    },

    async delete(id) {
      const rows = await db
        .delete(meals)
        .where(eq(meals.id, id))
        .returning({ id: meals.id });
      return rows.length > 0;
    },

    async countOrdersForMeal(mealId) {
      const [row] = await db
        .select({ value: count() })
        .from(orders)
        .where(eq(orders.mealId, mealId));
      return Number(row?.value ?? 0);
    },
  };
}

export function createOrderRepository(db: Database): OrderRepository {
  const selectWithUser = () =>
    db
      .select({
        order: orders,
        userDisplayName: users.displayName,
        userDiscordId: users.discordId,
      })
      .from(orders)
      .innerJoin(users, eq(orders.userId, users.id));

  return {
    async create(input: CreateOrderRecord) {
      const [row] = await db.insert(orders).values(input).returning();
      if (!row) throw new Error("Failed to create order");
      return row;
    },

    async findById(id) {
      const [row] = await selectWithUser()
        .where(eq(orders.id, id))
        .limit(1);
      return row ? withUser(row.order, row.userDisplayName, row.userDiscordId) : null;
    },

    async findByIdempotencyKey(key) {
      const [row] = await selectWithUser()
        .where(eq(orders.idempotencyKey, key))
        .limit(1);
      return row ? withUser(row.order, row.userDisplayName, row.userDiscordId) : null;
    },

    async listForUser(userId, limit, offset) {
      const rows = await selectWithUser()
        .where(eq(orders.userId, userId))
        .orderBy(desc(orders.createdAt), desc(orders.id))
        .limit(limit)
        .offset(offset);
      return rows.map((row) => withUser(row.order, row.userDisplayName, row.userDiscordId));
    },

    async countForUser(userId) {
      const [row] = await db
        .select({ value: count() })
        .from(orders)
        .where(eq(orders.userId, userId));
      return Number(row?.value ?? 0);
    },

    async listByStatuses(statuses, limit, offset) {
      const rows = await selectWithUser()
        .where(inArray(orders.status, statuses))
        .orderBy(asc(orders.createdAt), asc(orders.id))
        .limit(limit)
        .offset(offset);
      return rows.map((row) => withUser(row.order, row.userDisplayName, row.userDiscordId));
    },

    async countByStatuses(statuses) {
      const [row] = await db
        .select({ value: count() })
        .from(orders)
        .where(inArray(orders.status, statuses));
      return Number(row?.value ?? 0);
    },

    async findStatus(id) {
      const [row] = await db
        .select({ status: orders.status })
        .from(orders)
        .where(eq(orders.id, id))
        .limit(1);
      return row?.status ?? null;
    },

    async transition(id, from: OrderStatus, to: OrderStatus) {
      const rows = await db
        .update(orders)
        .set({ status: to, updatedAt: new Date() })
        .where(and(eq(orders.id, id), eq(orders.status, from)))
        .returning({ id: orders.id });
      return rows.length > 0;
    },
  };
}

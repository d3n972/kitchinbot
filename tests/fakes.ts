import type { Meal, Order, OrderStatus, User } from "../src/db/schema.ts";
import type { Logger } from "../src/logger.ts";
import type {
  CreateOrderRecord,
  MealRepository,
  OrderRepository,
  OrderWithUser,
  UserRepository,
} from "../src/services/repositories.ts";
import type { OrderNotifier } from "../src/notifications/types.ts";

export const silentLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

export interface FakeStore {
  users: User[];
  meals: Meal[];
  orders: Order[];
  nextUserId: number;
  nextMealId: number;
  nextOrderId: number;
}

export interface FakeRepositories {
  store: FakeStore;
  users: UserRepository;
  meals: MealRepository;
  orders: OrderRepository;
  notified: OrderWithUser[];
  notifier: OrderNotifier;
}

export function createFakes(): FakeRepositories {
  let clock = Date.parse("2026-01-01T12:00:00Z");

  const now = (): Date => {
    clock += 1000;
    return new Date(clock);
  };

  const store: FakeStore = {
    users: [],
    meals: [],
    orders: [],
    nextUserId: 1,
    nextMealId: 1,
    nextOrderId: 1001,
  };

  const toWithUser = (order: Order): OrderWithUser => {
    const user = store.users.find((candidate) => candidate.id === order.userId);
    if (!user) throw new Error("Fake order references a missing user");
    return {
      ...order,
      userDisplayName: user.displayName,
      userDiscordId: user.discordId,
    };
  };

  const notified: OrderWithUser[] = [];

  const users: UserRepository = {
    async upsert(discordId, displayName) {
      const existing = store.users.find(
        (user) => user.discordId === discordId,
      );
      if (existing) {
        existing.displayName = displayName;
        existing.updatedAt = now();
        return { ...existing };
      }

      const user: User = {
        id: store.nextUserId++,
        discordId,
        displayName,
        createdAt: now(),
        updatedAt: now(),
      };
      store.users.push(user);
      return { ...user };
    },

    async findById(id) {
      const user = store.users.find((candidate) => candidate.id === id);
      return user ? { ...user } : null;
    },

    async findByDiscordId(discordId) {
      const user = store.users.find(
        (candidate) => candidate.discordId === discordId,
      );
      return user ? { ...user } : null;
    },
  };

  const meals: MealRepository = {
    async listEnabled() {
      return store.meals
        .filter((meal) => meal.enabled)
        .map((meal) => ({ ...meal }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    async listAll() {
      return store.meals
        .map((meal) => ({ ...meal }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    async findById(id) {
      const meal = store.meals.find((candidate) => candidate.id === id);
      return meal ? { ...meal } : null;
    },

    async create(name) {
      const timestamp = now();
      const meal: Meal = {
        id: store.nextMealId++,
        name,
        enabled: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      store.meals.push(meal);
      return { ...meal };
    },

    async rename(id, name) {
      const meal = store.meals.find((candidate) => candidate.id === id);
      if (!meal) return null;
      meal.name = name;
      meal.updatedAt = now();
      return { ...meal };
    },

    async setEnabled(id, enabled) {
      const meal = store.meals.find((candidate) => candidate.id === id);
      if (!meal) return null;
      meal.enabled = enabled;
      meal.updatedAt = now();
      return { ...meal };
    },

    async delete(id) {
      const index = store.meals.findIndex((candidate) => candidate.id === id);
      if (index === -1) return false;
      store.meals.splice(index, 1);
      return true;
    },

    async countOrdersForMeal(mealId) {
      return store.orders.filter((order) => order.mealId === mealId).length;
    },
  };

  const orders: OrderRepository = {
    async create(input: CreateOrderRecord) {
      if (
        input.idempotencyKey &&
        store.orders.some(
          (order) => order.idempotencyKey === input.idempotencyKey,
        )
      ) {
        const error = Object.assign(new Error("duplicate key"), {
          code: "23505",
        });
        throw error;
      }

      const timestamp = now();
      const order: Order = {
        id: store.nextOrderId++,
        userId: input.userId,
        status: "ORDERED",
        mealId: input.mealId,
        mealName: input.mealName,
        customText: input.customText,
        idempotencyKey: input.idempotencyKey,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      store.orders.push(order);
      return { ...order };
    },

    async findById(id) {
      const order = store.orders.find((candidate) => candidate.id === id);
      return order ? toWithUser(order) : null;
    },

    async findByIdempotencyKey(key) {
      const order = store.orders.find(
        (candidate) => candidate.idempotencyKey === key,
      );
      return order ? toWithUser(order) : null;
    },

    async listForUser(userId, limit, offset) {
      return store.orders
        .filter((order) => order.userId === userId)
        .sort(
          (a, b) =>
            b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id,
        )
        .slice(offset, offset + limit)
        .map(toWithUser);
    },

    async countForUser(userId) {
      return store.orders.filter((order) => order.userId === userId).length;
    },

    async listByStatuses(statuses, limit, offset) {
      return store.orders
        .filter((order) => statuses.includes(order.status))
        .sort(
          (a, b) =>
            a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id,
        )
        .slice(offset, offset + limit)
        .map(toWithUser);
    },

    async countByStatuses(statuses) {
      return store.orders.filter((order) => statuses.includes(order.status))
        .length;
    },

    async findStatus(id) {
      return (
        store.orders.find((candidate) => candidate.id === id)?.status ?? null
      );
    },

    async transition(id, from: OrderStatus, to: OrderStatus) {
      const order = store.orders.find((candidate) => candidate.id === id);
      if (!order || order.status !== from) return false;
      order.status = to;
      order.updatedAt = now();
      return true;
    },
  };

  const notifier: OrderNotifier = {
    async notifyNewOrder(order) {
      notified.push(order);
    },
  };

  return { store, users, meals, orders, notified, notifier };
}

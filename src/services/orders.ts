import type { Logger } from "../logger.ts";
import {
  ACTIVE_STATUSES,
  nextStatus,
  type OrderAction,
} from "../domain/order-status.ts";
import {
  ConflictError,
  InvalidTransitionError,
  NotFoundError,
  ValidationError,
} from "../domain/errors.ts";
import type { OrderNotifier } from "../notifications/types.ts";
import type {
  MealRepository,
  OrderRepository,
  OrderWithUser,
  UserRepository,
} from "./repositories.ts";

export const HISTORY_PAGE_SIZE = 10;
export const KITCHEN_PAGE_SIZE = 4;
export const CUSTOM_TEXT_MAX_LENGTH = 4000;

export interface OrderActor {
  discordId: string;
  displayName: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageCount: number;
  total: number;
}

export interface OrderServiceDeps {
  orders: OrderRepository;
  users: UserRepository;
  meals: MealRepository;
  notifier: OrderNotifier;
  logger: Logger;
}

export interface OrderService {
  createPredefined(
    actor: OrderActor,
    mealId: number,
    idempotencyKey: string | null,
  ): Promise<OrderWithUser>;
  createCustom(
    actor: OrderActor,
    customText: string,
    idempotencyKey: string | null,
  ): Promise<OrderWithUser>;
  listForUser(userId: number, page: number): Promise<Page<OrderWithUser>>;
  listForActor(actor: OrderActor, page: number): Promise<Page<OrderWithUser>>;
  listKitchen(page: number): Promise<Page<OrderWithUser>>;
  getById(orderId: number): Promise<OrderWithUser>;
  getForActor(orderId: number, actor: OrderActor): Promise<OrderWithUser>;
  advance(orderId: number, action: OrderAction): Promise<OrderWithUser>;
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: unknown;
    errno?: unknown;
    cause?: unknown;
  };
  return (
    candidate.code === "23505" ||
    candidate.errno === "23505" ||
    isUniqueViolation(candidate.cause)
  );
}

function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

function clampPage(page: number, pageCountValue: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(1, Math.trunc(page)), pageCountValue);
}

function normalizeIdempotencyKey(key: string | null): string | null {
  const trimmed = key?.trim();
  return trimmed ? trimmed : null;
}

export function createOrderService(deps: OrderServiceDeps): OrderService {
  const { orders, users, meals, notifier, logger } = deps;

  const notifyInBackground = (order: OrderWithUser): void => {
    void notifier.notifyNewOrder(order).catch((error: unknown) => {
      logger.error("Order notification failed", {
        orderId: order.id,
        error,
      });
    });
  };

  const getById = async (orderId: number): Promise<OrderWithUser> => {
    const order = await orders.findById(orderId);
    if (!order) throw new NotFoundError("Order not found.");
    return order;
  };

  const listForUser = async (
    userId: number,
    page: number,
  ): Promise<Page<OrderWithUser>> => {
    const total = await orders.countForUser(userId);
    const pageCountValue = pageCount(total, HISTORY_PAGE_SIZE);
    const currentPage = clampPage(page, pageCountValue);
    const items = await orders.listForUser(
      userId,
      HISTORY_PAGE_SIZE,
      (currentPage - 1) * HISTORY_PAGE_SIZE,
    );
    return { items, page: currentPage, pageCount: pageCountValue, total };
  };

  const persist = async (
    actor: OrderActor,
    content: {
      mealId: number | null;
      mealName: string | null;
      customText: string | null;
    },
    idempotencyKey: string | null,
  ): Promise<OrderWithUser> => {
    const key = normalizeIdempotencyKey(idempotencyKey);

    if (key) {
      const existing = await orders.findByIdempotencyKey(key);
      if (existing) return existing;
    }

    const user = await users.upsert(actor.discordId, actor.displayName);

    try {
      const order = await orders.create({
        userId: user.id,
        ...content,
        idempotencyKey: key,
      });

      const created: OrderWithUser = {
        ...order,
        userDisplayName: user.displayName,
        userDiscordId: user.discordId,
      };
      notifyInBackground(created);
      return created;
    } catch (error) {
      if (key && isUniqueViolation(error)) {
        const existing = await orders.findByIdempotencyKey(key);
        if (existing) return existing;
      }
      throw error;
    }
  };

  return {
    async createPredefined(actor, mealId, idempotencyKey) {
      if (!Number.isSafeInteger(mealId) || mealId <= 0) {
        throw new ValidationError("That meal is no longer on the menu.");
      }

      const meal = await meals.findById(mealId);
      if (!meal) {
        throw new ValidationError("That meal is no longer on the menu.");
      }
      if (!meal.enabled) {
        throw new ValidationError(
          "That meal is currently unavailable. Pick another one, or use a custom order.",
        );
      }

      return persist(
        actor,
        { mealId: meal.id, mealName: meal.name, customText: null },
        idempotencyKey,
      );
    },

    async createCustom(actor, customText, idempotencyKey) {
      if (customText.trim().length === 0) {
        throw new ValidationError("Please describe what you would like.");
      }
      if (customText.length > CUSTOM_TEXT_MAX_LENGTH) {
        throw new ValidationError(
          `Custom orders can be at most ${CUSTOM_TEXT_MAX_LENGTH} characters.`,
        );
      }

      return persist(
        actor,
        { mealId: null, mealName: null, customText },
        idempotencyKey,
      );
    },

    listForUser,

    async listForActor(actor, page) {
      const user = await users.findByDiscordId(actor.discordId);
      if (!user) {
        return { items: [], page: 1, pageCount: 1, total: 0 };
      }
      return listForUser(user.id, page);
    },

    async listKitchen(page) {
      const total = await orders.countByStatuses(ACTIVE_STATUSES);
      const pageCountValue = pageCount(total, KITCHEN_PAGE_SIZE);
      const currentPage = clampPage(page, pageCountValue);
      const items = await orders.listByStatuses(
        ACTIVE_STATUSES,
        KITCHEN_PAGE_SIZE,
        (currentPage - 1) * KITCHEN_PAGE_SIZE,
      );
      return { items, page: currentPage, pageCount: pageCountValue, total };
    },

    getById,

    async getForActor(orderId, actor) {
      const order = await getById(orderId);
      if (order.userDiscordId !== actor.discordId) {
        throw new NotFoundError("Order not found.");
      }
      return order;
    },

    async advance(orderId, action) {
      const current = await orders.findStatus(orderId);
      if (!current) throw new NotFoundError("Order not found.");

      const target = nextStatus(current, action);
      if (!target) throw new InvalidTransitionError(current, action);

      const updated = await orders.transition(orderId, current, target);
      if (!updated) {
        throw new ConflictError(
          "That order changed a moment ago. Here is the latest state.",
        );
      }

      return getById(orderId);
    },
  };
}

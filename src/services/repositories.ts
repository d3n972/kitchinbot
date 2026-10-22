import type { Meal, Order, OrderStatus, User } from "../db/schema.ts";

export interface OrderWithUser extends Order {
  userDisplayName: string;
  userDiscordId: string;
}

export interface CreateOrderRecord {
  userId: number;
  mealId: number | null;
  mealName: string | null;
  customText: string | null;
  idempotencyKey: string | null;
}

export interface UserRepository {
  upsert(discordId: string, displayName: string): Promise<User>;
  findById(id: number): Promise<User | null>;
  findByDiscordId(discordId: string): Promise<User | null>;
}

export interface MealRepository {
  listEnabled(): Promise<Meal[]>;
  listAll(): Promise<Meal[]>;
  findById(id: number): Promise<Meal | null>;
  create(name: string): Promise<Meal>;
  rename(id: number, name: string): Promise<Meal | null>;
  setEnabled(id: number, enabled: boolean): Promise<Meal | null>;
  delete(id: number): Promise<boolean>;
  countOrdersForMeal(mealId: number): Promise<number>;
}

export interface OrderRepository {
  create(input: CreateOrderRecord): Promise<Order>;
  findById(id: number): Promise<OrderWithUser | null>;
  findByIdempotencyKey(key: string): Promise<OrderWithUser | null>;
  listForUser(
    userId: number,
    limit: number,
    offset: number,
  ): Promise<OrderWithUser[]>;
  countForUser(userId: number): Promise<number>;
  listByStatuses(
    statuses: OrderStatus[],
    limit: number,
    offset: number,
  ): Promise<OrderWithUser[]>;
  countByStatuses(statuses: OrderStatus[]): Promise<number>;
  findStatus(id: number): Promise<OrderStatus | null>;
  transition(
    id: number,
    from: OrderStatus,
    to: OrderStatus,
  ): Promise<boolean>;
}

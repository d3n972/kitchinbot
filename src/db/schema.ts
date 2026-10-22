import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const ORDER_STATUSES = [
  "ORDERED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const orderStatusEnum = pgEnum("order_status", ORDER_STATUSES);

export const users = pgTable("users", {
  id: bigint("id", { mode: "number" })
    .primaryKey()
    .generatedAlwaysAsIdentity(),
  discordId: text("discord_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const meals = pgTable("meals", {
  id: bigint("id", { mode: "number" })
    .primaryKey()
    .generatedAlwaysAsIdentity({ startWith: 1 }),
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const orders = pgTable(
  "orders",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1001 }),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: orderStatusEnum("status").notNull().default("ORDERED"),
    mealId: bigint("meal_id", { mode: "number" }).references(() => meals.id, {
      onDelete: "restrict",
    }),
    mealName: text("meal_name"),
    customText: text("custom_text"),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "orders_exactly_one_content",
      sql`(
        (${table.mealId} IS NOT NULL AND ${table.mealName} IS NOT NULL AND ${table.customText} IS NULL)
        OR
        (${table.mealId} IS NULL AND ${table.mealName} IS NULL AND ${table.customText} IS NOT NULL AND length(btrim(${table.customText})) > 0)
      )`,
    ),
    check(
      "orders_custom_text_length",
      sql`${table.customText} IS NULL OR length(${table.customText}) <= 4000`,
    ),
    index("orders_user_created_idx").on(table.userId, table.createdAt),
    index("orders_status_idx").on(table.status),
    uniqueIndex("orders_idempotency_key_idx").on(table.idempotencyKey),
  ],
);

export type User = typeof users.$inferSelect;
export type Meal = typeof meals.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

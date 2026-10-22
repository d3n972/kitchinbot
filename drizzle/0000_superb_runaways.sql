CREATE TYPE "public"."order_status" AS ENUM('ORDERED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "meals" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "meals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1001 CACHE 1),
	"user_id" bigint NOT NULL,
	"status" "order_status" DEFAULT 'ORDERED' NOT NULL,
	"meal_id" bigint,
	"meal_name" text,
	"custom_text" text,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_exactly_one_content" CHECK ((
        ("orders"."meal_id" IS NOT NULL AND "orders"."meal_name" IS NOT NULL AND "orders"."custom_text" IS NULL)
        OR
        ("orders"."meal_id" IS NULL AND "orders"."meal_name" IS NULL AND "orders"."custom_text" IS NOT NULL AND length(btrim("orders"."custom_text")) > 0)
      )),
	CONSTRAINT "orders_custom_text_length" CHECK ("orders"."custom_text" IS NULL OR length("orders"."custom_text") <= 4000)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"discord_id" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_discord_id_unique" UNIQUE("discord_id")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_meal_id_meals_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_user_created_idx" ON "orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_idempotency_key_idx" ON "orders" USING btree ("idempotency_key");
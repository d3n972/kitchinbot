ALTER TABLE "meals" ADD COLUMN "recipe" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "meal_recipe" text;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_recipe_requires_meal" CHECK ("orders"."meal_recipe" IS NULL OR "orders"."meal_id" IS NOT NULL);
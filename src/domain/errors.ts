import type { OrderStatus } from "../db/schema.ts";
import type { OrderAction } from "./order-status.ts";

/** The request was structurally invalid; the message is safe to show to users. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** The referenced record does not exist (or is no longer visible). */
export class NotFoundError extends Error {
  constructor(message = "Not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Another writer changed the record concurrently. */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class InvalidTransitionError extends ValidationError {
  readonly current: OrderStatus;
  readonly action: OrderAction;

  constructor(current: OrderStatus, action: OrderAction) {
    super(`Cannot ${action} an order that is ${current}.`);
    this.name = "InvalidTransitionError";
    this.current = current;
    this.action = action;
  }
}

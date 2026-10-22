import type { OrderWithUser } from "../services/repositories.ts";

export interface OrderNotifier {
  /** Attempts both delivery channels independently; never rejects. */
  notifyNewOrder(order: OrderWithUser): Promise<void>;
}

import type { NtfyConfig } from "../config.ts";
import type { OrderWithUser } from "../services/repositories.ts";
import { truncate } from "../text.ts";
import { buildNtfyMessage } from "./format.ts";

const REQUEST_TIMEOUT_MS = 10_000;

/** Publishes one notification through the ntfy JSON API. Throws on failure. */
export function createNtfySender(config: NtfyConfig) {
  return async function sendNtfy(order: OrderWithUser): Promise<void> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (config.token) headers.Authorization = `Bearer ${config.token}`;

    const response = await fetch(config.url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        topic: config.topic,
        message: buildNtfyMessage(order),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `ntfy responded ${response.status}${body ? `: ${truncate(body.trim(), 200)}` : ""}`,
      );
    }
  };
}

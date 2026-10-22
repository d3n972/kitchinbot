import { describe, expect, test } from "bun:test";
import { startHealthServer } from "../src/health.ts";
import { silentLogger } from "./fakes.ts";

describe("health server", () => {
  test("serves liveness and readiness probes", async () => {
    let ready = false;
    const server = startHealthServer({
      port: 0,
      isReady: () => ready,
      logger: silentLogger,
    });
    const base = `http://127.0.0.1:${server.port}`;

    try {
      const live = await fetch(`${base}/livez`);
      expect(live.status).toBe(200);
      expect(await live.text()).toBe("ok\n");

      const notReady = await fetch(`${base}/readyz`);
      expect(notReady.status).toBe(503);

      ready = true;
      const readyResponse = await fetch(`${base}/readyz`);
      expect(readyResponse.status).toBe(200);

      const missing = await fetch(`${base}/nope`);
      expect(missing.status).toBe(404);
    } finally {
      server.stop();
    }
  });
});

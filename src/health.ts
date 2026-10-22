import type { Logger } from "./logger.ts";

export interface HealthServer {
  readonly port: number;
  stop(): void;
}

export interface HealthServerOptions {
  port: number;
  isReady: () => boolean;
  logger: Logger;
}

/**
 * Tiny probe endpoint for Kubernetes. There is deliberately no Service or
 * Ingress attached to it: only the kubelet needs to reach it.
 */
export function startHealthServer(options: HealthServerOptions): HealthServer {
  const server = Bun.serve({
    hostname: "0.0.0.0",
    port: options.port,
    fetch(request) {
      const path = new URL(request.url).pathname;

      if (path === "/livez") {
        return new Response("ok\n", { status: 200 });
      }

      if (path === "/readyz") {
        const ready = options.isReady();
        return new Response(ready ? "ready\n" : "not ready\n", {
          status: ready ? 200 : 503,
        });
      }

      return new Response("not found\n", { status: 404 });
    },
  });

  options.logger.info("Health endpoint listening", { port: server.port });

  return {
    port: server.port ?? options.port,
    stop: () => {
      server.stop(true);
    },
  };
}

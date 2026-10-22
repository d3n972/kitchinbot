import type { LogLevel } from "./config.ts";

export interface Logger {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

const PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function errorFields(error: Error): Record<string, unknown> {
  return { name: error.name, message: error.message, stack: error.stack };
}

function serialize(meta: unknown): string {
  if (meta === undefined) return "";
  try {
    return ` ${JSON.stringify(meta, (_key, value: unknown) =>
      value instanceof Error ? errorFields(value) : value,
    )}`;
  } catch {
    return ` ${String(meta)}`;
  }
}

export function createLogger(level: LogLevel): Logger {
  const threshold = PRIORITY[level];

  const log = (entryLevel: LogLevel, message: string, meta?: unknown) => {
    if (PRIORITY[entryLevel] < threshold) return;
    const line = `${new Date().toISOString()} ${entryLevel.toUpperCase().padEnd(5)} ${message}${serialize(meta)}`;
    if (entryLevel === "error") console.error(line);
    else if (entryLevel === "warn") console.warn(line);
    else console.log(line);
  };

  return {
    debug: (message, meta) => log("debug", message, meta),
    info: (message, meta) => log("info", message, meta),
    warn: (message, meta) => log("warn", message, meta),
    error: (message, meta) => log("error", message, meta),
  };
}

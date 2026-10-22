export type LogLevel = "debug" | "info" | "warn" | "error";

export interface DiscordConfig {
  token: string;
  applicationId: string;
  guildId?: string;
}

export interface NtfyConfig {
  url: string;
  topic: string;
  token?: string;
}

export interface AppConfig {
  discord: DiscordConfig;
  adminDiscordId: string;
  databaseUrl: string;
  ntfy: NtfyConfig;
  logLevel: LogLevel;
  healthPort: number;
  isDev: boolean;
}

const SNOWFLAKE = /^\d{17,20}$/;
const NTFY_TOPIC = /^[A-Za-z0-9_-]{1,64}$/;
const LOG_LEVELS: readonly LogLevel[] = ["debug", "info", "warn", "error"];

class ConfigError extends Error {}

function read(
  env: Record<string, string | undefined>,
  key: string,
): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

export function loadConfig(
  env: Record<string, string | undefined> = process.env,
): AppConfig {
  const errors: string[] = [];

  const require = (key: string): string => {
    const value = read(env, key);
    if (!value) {
      errors.push(`${key} is required`);
      return "";
    }
    return value;
  };

  const requireSnowflake = (key: string): string => {
    const value = require(key);
    if (value && !SNOWFLAKE.test(value)) {
      errors.push(`${key} must be a Discord snowflake (numeric ID)`);
    }
    return value;
  };

  const token = require("DISCORD_TOKEN");
  const applicationId = requireSnowflake("DISCORD_APP_ID");
  const adminDiscordId = requireSnowflake("ADMIN_DISCORD_ID");
  const databaseUrl = require("DATABASE_URL");
  const ntfyTopic = require("NTFY_TOPIC");

  const guildId = read(env, "DISCORD_GUILD_ID");
  if (guildId && !SNOWFLAKE.test(guildId)) {
    errors.push("DISCORD_GUILD_ID must be a Discord snowflake (numeric ID)");
  }

  if (databaseUrl && !/^postgres(ql)?:\/\//.test(databaseUrl)) {
    errors.push("DATABASE_URL must be a postgres:// or postgresql:// URL");
  }

  if (ntfyTopic && !NTFY_TOPIC.test(ntfyTopic)) {
    errors.push(
      "NTFY_TOPIC must be 1-64 characters of letters, digits, '_' or '-'",
    );
  }

  const ntfyUrl = (read(env, "NTFY_URL") ?? "https://ntfy.sh").replace(
    /\/+$/,
    "",
  );
  try {
    const parsed = new URL(ntfyUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      errors.push("NTFY_URL must use http:// or https://");
    }
  } catch {
    errors.push("NTFY_URL must be a valid URL");
  }

  const logLevel = (read(env, "LOG_LEVEL") ?? "info") as LogLevel;
  if (!LOG_LEVELS.includes(logLevel)) {
    errors.push(`LOG_LEVEL must be one of: ${LOG_LEVELS.join(", ")}`);
  }

  const healthPort = Number(read(env, "HEALTH_PORT") ?? "8080");
  if (
    !Number.isInteger(healthPort) ||
    healthPort < 1 ||
    healthPort > 65535
  ) {
    errors.push("HEALTH_PORT must be an integer between 1 and 65535");
  }

  if (errors.length > 0) {
    throw new ConfigError(
      `Invalid configuration:\n${errors.map((e) => `  - ${e}`).join("\n")}\n\n` +
        "Check your .env file (see .env.example).",
    );
  }

  return {
    discord: {
      token,
      applicationId,
      ...(guildId ? { guildId } : {}),
    },
    adminDiscordId,
    databaseUrl,
    ntfy: {
      url: ntfyUrl,
      topic: ntfyTopic,
      ...(read(env, "NTFY_TOKEN")
        ? { token: read(env, "NTFY_TOKEN") }
        : {}),
    },
    logLevel,
    healthPort,
    isDev: env.NODE_ENV !== "production",
  };
}

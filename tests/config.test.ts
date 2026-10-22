import { describe, expect, test } from "bun:test";
import { loadConfig } from "../src/config.ts";

const validEnv = {
  DISCORD_TOKEN: "bot-token",
  DISCORD_APP_ID: "123456789012345678",
  ADMIN_DISCORD_ID: "876543210987654321",
  DATABASE_URL: "postgres://kitchen:kitchen@localhost:5432/kitchenbot",
  NTFY_TOPIC: "home-kitchen",
};

describe("config", () => {
  test("accepts a minimal valid environment", () => {
    const config = loadConfig(validEnv);

    expect(config.discord.token).toBe("bot-token");
    expect(config.discord.guildId).toBeUndefined();
    expect(config.ntfy.url).toBe("https://ntfy.sh");
    expect(config.ntfy.token).toBeUndefined();
    expect(config.logLevel).toBe("info");
    expect(config.healthPort).toBe(8080);
    expect(config.isDev).toBe(true);
  });

  test("trims NTFY_URL and accepts optional values", () => {
    const config = loadConfig({
      ...validEnv,
      DISCORD_GUILD_ID: "111111111111111111",
      NTFY_URL: "https://ntfy.example.dev/",
      NTFY_TOKEN: "tk_secret",
      LOG_LEVEL: "debug",
      HEALTH_PORT: "9090",
      NODE_ENV: "production",
    });

    expect(config.ntfy.url).toBe("https://ntfy.example.dev");
    expect(config.ntfy.token).toBe("tk_secret");
    expect(config.discord.guildId).toBe("111111111111111111");
    expect(config.logLevel).toBe("debug");
    expect(config.healthPort).toBe(9090);
    expect(config.isDev).toBe(false);
  });

  test("reports all missing variables at once", () => {
    expect(() => loadConfig({})).toThrow(/DISCORD_TOKEN/);
    expect(() => loadConfig({})).toThrow(/DISCORD_APP_ID/);
    expect(() => loadConfig({})).toThrow(/ADMIN_DISCORD_ID/);
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
    expect(() => loadConfig({})).toThrow(/NTFY_TOPIC/);
  });

  test("rejects malformed values", () => {
    expect(() =>
      loadConfig({ ...validEnv, ADMIN_DISCORD_ID: "not-an-id" }),
    ).toThrow(/ADMIN_DISCORD_ID/);
    expect(() =>
      loadConfig({ ...validEnv, DATABASE_URL: "mysql://nope" }),
    ).toThrow(/DATABASE_URL/);
    expect(() =>
      loadConfig({ ...validEnv, NTFY_TOPIC: "has spaces" }),
    ).toThrow(/NTFY_TOPIC/);
    expect(() =>
      loadConfig({ ...validEnv, NTFY_URL: "not a url" }),
    ).toThrow(/NTFY_URL/);
    expect(() =>
      loadConfig({ ...validEnv, LOG_LEVEL: "loud" }),
    ).toThrow(/LOG_LEVEL/);
    expect(() =>
      loadConfig({ ...validEnv, HEALTH_PORT: "70000" }),
    ).toThrow(/HEALTH_PORT/);
  });
});

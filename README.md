# kitchenbot

Private household food-ordering bot. Members order from a predefined meal
catalogue or submit a free-form custom request through Discord; the household
administrator gets notified and manages preparation from the same `/menu` entry
point.

The full product specification lives in [spec.md](./spec.md). There is no
pricing, inventory, scheduling, or free-text interpretation: a custom order is
stored verbatim.

## Stack

- Bun + TypeScript (discord.js v14)
- PostgreSQL via Drizzle ORM (`bun-sql` driver)
- ntfy.sh and Discord DM notifications

## Prerequisites

- Bun 1.4+
- Docker (for the development database)
- A Discord application with a bot
- An ntfy topic

## Discord setup

1. Create an application at <https://discord.com/developers/applications>.
2. Copy the **bot token** from the Bot tab and the **Application ID** from
   General Information.
3. No privileged intents are required. The bot only needs the `Guilds` intent.
4. Under OAuth2 → URL Generator, select the `bot` and `applications.commands`
   scopes and the Send Messages, Embed Links, and Use Application Commands
   permissions. Invite the bot to your household server.
5. The bot must share a server with the administrator so it can DM them.
6. Enable Developer Mode in Discord, then right-click your own name →
   **Copy User ID** for `ADMIN_DISCORD_ID`.
7. Copy the server ID for `DISCORD_GUILD_ID` (recommended in development:
   guild commands appear immediately; global commands can take up to an hour).
8. Pick a private ntfy topic for `NTFY_TOPIC` and subscribe to it in the ntfy
   app. Add `NTFY_TOKEN` only if the topic is protected.

## Development

```bash
bun install
cp .env.example .env   # fill in the Discord and ntfy values
bun run db:up          # local Postgres 16 via docker compose
bun run dev            # migrations run on boot, then the bot logs in
```

Bun loads `.env` automatically; `.env.local` and `.env.development.local`
override it and are already gitignored. The app refuses to start if required
configuration is missing or malformed.

### Environment

| Variable            | Required | Default                     | Purpose                                          |
| ------------------- | -------- | --------------------------- | ------------------------------------------------ |
| `DISCORD_TOKEN`     | yes      | —                           | Bot token                                        |
| `DISCORD_APP_ID`    | yes      | —                           | Application ID; checked against the token        |
| `DISCORD_GUILD_ID`  | no       | global commands             | Dev guild for instant slash-command registration |
| `ADMIN_DISCORD_ID`  | yes      | —                           | The only user allowed to use kitchen/meal admin  |
| `DATABASE_URL`      | yes      | —                           | PostgreSQL connection URL                        |
| `NTFY_URL`          | no       | `https://ntfy.sh`           | ntfy server base URL                             |
| `NTFY_TOPIC`        | yes      | —                           | ntfy topic to publish to                         |
| `NTFY_TOKEN`        | no       | —                           | Bearer token for protected topics                |
| `LOG_LEVEL`         | no       | `info`                      | `debug`, `info`, `warn`, or `error`              |
| `HEALTH_PORT`       | no       | `8080`                      | Probe endpoint port (`/livez`, `/readyz`)        |

### Scripts

| Command              | Description                                              |
| -------------------- | -------------------------------------------------------- |
| `bun run dev`        | Watch mode                                               |
| `bun run start`      | Run once                                                 |
| `bun run db:up`      | Start the compose Postgres and wait until healthy        |
| `bun run db:down`    | Stop the compose Postgres                                |
| `bun run db:reset`   | **Destroy** the dev database volume and recreate it      |
| `bun run db:generate`| Generate a migration after editing `src/db/schema.ts`    |
| `bun run db:migrate` | Apply migrations without starting the bot                |
| `bun test`           | Unit tests (no Discord, ntfy, or database needed)        |
| `bun run typecheck`  | `tsc --noEmit`                                           |
| `bun run check`      | Typecheck + tests                                        |

If port 5432 is already in use, change the published port in
`docker-compose.yml` and update `DATABASE_URL` to match.

## Behaviour

`/menu` is the only slash command. Responses are ephemeral.

- **Order** — pick an enabled meal and confirm, or choose `✍️ Custom` and type
  whatever you want. Custom text is persisted exactly as submitted; only a
  trim is used to reject empty input.
- **My Orders** — a user's own history, scoped by Discord ID.
- **Kitchen** (admin only) — outstanding orders with `Start Preparing`,
  `Mark Ready`, `Complete`, and `Cancel` actions. Invalid transitions are
  rejected server-side, not just hidden in the UI.
- **Meals** (admin only) — add, rename, enable/disable, and remove catalogue
  entries. Disabling hides a meal from ordering; meals tied to order history
  cannot be deleted.

Order creation commits first, then fires both notifications independently.
Delivery failures are logged and never affect the stored order. There is no
retry queue by design.

## Layout

```
index.ts                 boot, migrations, Discord client, shutdown
src/config.ts            env validation
src/db/                  schema, Drizzle repositories, migrations
src/domain/              status transitions and errors
src/services/            order and meal application logic
src/notifications/       Discord DM + ntfy delivery
src/discord/             command, router, views
tests/                   unit tests with in-memory repositories
drizzle/                 generated SQL migrations (commit these)
```

Pagination and state live in Discord `customId`s, so restarting the bot does
not invalidate open menus.

## Health endpoint

The process serves `GET /livez` (always 200 while running) and `GET /readyz`
(200 once the Discord gateway is ready) on `HEALTH_PORT`, default `8080`.
Kubernetes uses these for probes; there is deliberately no Service or Ingress
attached.

## Container image

`Dockerfile` builds a multi-stage Bun image. GitHub Actions
(`.github/workflows/image.yaml`) publishes multi-arch images to GHCR:

- `ghcr.io/d3n972/kitchinbot:v0.1.0` (git tag)
- `ghcr.io/d3n972/kitchinbot:sha-<short>` on every `main` push
- `ghcr.io/d3n972/kitchinbot:latest` on `main`

The package is public, so the cluster needs no image pull secret.

## Deployment

The Kubernetes manifests live in the separate devops repository
(`deploy/base/kitchenbot` + `apps/kitchenbot`), deployed to the rpi5 cluster
only. The app expects:

- `DATABASE_URL` pointing at PostgreSQL (CNPG in the target cluster).
- Outbound HTTPS to Discord and the configured ntfy endpoint.
- Migrations are applied automatically at boot under a Postgres advisory lock,
  so a single replica is required. `bun run db:migrate` is also available for
  a dedicated migration job.
- `SIGTERM`/`SIGINT` stop the health server, close the Discord client, and
  close the database pool cleanly.

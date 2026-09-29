# tinyPet — conventions

Spec: `docs/tinyPet — Especificação do Produto (MVP).md`. API contract: `docs/api-contract.md`, blog: `docs/blog-contract.md`. Deploy: `docs/deploy.md`.

## Layout — one repo, two projects (+ shared)
- `tinyPet/` = **web project** (`@tinypet/web`): Next.js 14 App Router + Tailwind 3. UI **and** REST API (`app/api/v1/**`). Port 3033. Owns the **database**: `prisma/schema.prisma`, `prisma/seed.ts`, `docker-compose.yml` (MySQL, port 3307), Prisma client in `src/db` — import `{ prisma, Prisma }` from `@/db`. Env: `tinyPet/.env`.
- `tinyPetApp/` = **app project** (`@tinypet/app`): Expo SDK 52 + Expo Router 4, iOS/Android. Talks to the API only (HTTP + JWT); never imports from `tinyPet/` or the DB. Env: `tinyPetApp/.env` (`EXPO_PUBLIC_API_URL`).
- `shared/` (`@tinypet/shared`): Zod schemas (= API contract), constants, utils — the only code both projects share. Exception: blog schemas live in `tinyPet/src/server/blog/*`.
- Root: pnpm workspace + turbo only (no app code, no `.env`). DB scripts from root proxy to the web: `pnpm db:up`, `pnpm db:push`, `pnpm db:seed`.
- Hosting: self-hosted Node on AWS EC2 / Oracle Cloud behind nginx/Caddy (`TRUST_PROXY=1`). **No Vercel**: jobs (`/api/v1/jobs/*`, `cronRoute`) run from the server crontab. Media on AWS S3.

## Rules
- Code, models, fields, enums in English. UI strings in pt-BR. Money `Decimal(10,2)`, dates UTC, display in America/Sao_Paulo.
- Every partner-panel query filters by `ctx.partnerId` from `requirePartner(req)` (header `X-Partner-Id`).
- Route handlers: wrap in `handler()` from `@/server`, validate with `parseBody(req, schema)` / `parseQuery`, return `ok(data)`; throw `Errors.*`. Responses: `{ ok: true, data, meta? }` or `{ ok: false, error: { code, message, details } }`.
- Plan limits: `assertLimit("PARTNER"|"OWNER", id, featureKey, currentCount)` before creating; `assertFeature` for booleans. 402 `PLAN_LIMIT`.
- Serialize Prisma results with `serialize()` when they contain Decimal.
- Soft delete (`deletedAt`) for Client, Pet, CatalogItem, Partner, User, PetMedia, BlogPost, BlogMedia, BlogComment. Always filter `deletedAt: null`.
- Media: client calls `POST /api/v1/media/upload` → PUT bytes to `uploadUrl` → `POST /api/v1/media/complete`. Never accept raw files in other routes — only exceptions (multipart, allowed in `middleware.ts`): `/admin/blog/media`, `/admin/blog/media/estimate`, `/clients/import`.
- Docs: when changing an endpoint, update `docs/api-contract.md` (or `docs/blog-contract.md`) in the same commit.
- Notifications: `notify()` / `notifyPartner()` from `@/server`.
- Web client: `api()` / `apiList()` from `@/lib/api-client` (React Query hooks in `src/hooks`).
- Demo logins (pw `tinypet123`): admin@tinypet.local, tutor@tinypet.local, parceiro@tinypet.local.

## Commands
`pnpm dev:web` · `pnpm dev:app` · `pnpm --filter @tinypet/web typecheck` · `pnpm --filter @tinypet/web test` · `pnpm --filter @tinypet/app typecheck` · `pnpm typecheck` (all)

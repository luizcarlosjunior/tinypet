# tinyPet — conventions

Spec: `docs/tinyPet — Especificação do Produto (MVP).md`. API contract: `docs/api-contract.md`.

## Layout
- `apps/web` Next.js 14 App Router + Tailwind 3. UI **and** REST API (`app/api/v1/**`). Port 3033.
- `apps/mobile` Expo SDK 52 + Expo Router 4, consumes the same API with JWT.
- `packages/db` Prisma 6 + MySQL (`docker compose up -d`, port 3307). `pnpm db:push`, `pnpm db:seed`.
- `packages/shared` Zod schemas (= API contract), constants, utils. Import as `@tinypet/shared`.

## Rules
- Code, models, fields, enums in English. UI strings in pt-BR. Money `Decimal(10,2)`, dates UTC, display in America/Sao_Paulo.
- Every partner-panel query filters by `ctx.partnerId` from `requirePartner(req)` (header `X-Partner-Id`).
- Route handlers: wrap in `handler()` from `@/server`, validate with `parseBody(req, schema)` / `parseQuery`, return `ok(data)`; throw `Errors.*`. Responses: `{ ok: true, data, meta? }` or `{ ok: false, error: { code, message, details } }`.
- Plan limits: `assertLimit("PARTNER"|"OWNER", id, featureKey, currentCount)` before creating; `assertFeature` for booleans. 402 `PLAN_LIMIT`.
- Serialize Prisma results with `serialize()` when they contain Decimal.
- Soft delete (`deletedAt`) for Client, Pet, CatalogItem, Partner, User. Always filter `deletedAt: null`.
- Media: client calls `POST /api/v1/media/upload` → PUT bytes to `uploadUrl` → `POST /api/v1/media/complete`. Never accept raw files in other routes.
- Notifications: `notify()` / `notifyPartner()` from `@/server`.
- Web client: `api()` / `apiList()` from `@/lib/api-client` (React Query hooks in `src/hooks`).
- Demo logins (pw `tinypet123`): admin@tinypet.local, tutor@tinypet.local, parceiro@tinypet.local.

## Commands
`pnpm dev:web` · `pnpm --filter @tinypet/web typecheck` · `pnpm --filter @tinypet/web test` · `pnpm dev:mobile`

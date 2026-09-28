# tinyPet

Conecta tutores de pets aos profissionais que cuidam deles. Monorepo com web (Next.js 14), app (Expo) e API única.

Spec completa: `docs/tinyPet — Especificação do Produto (MVP).md`. Contrato da API: `docs/api-contract.md`.

## Estrutura

| Pasta | O que é |
| --- | --- |
| `apps/web` | Site público, área do tutor, painel do parceiro, admin e a API REST (`/api/v1`). Porta 3001. |
| `apps/mobile` | App iOS/Android (Expo Router), consome a mesma API com JWT. |
| `packages/db` | Prisma + MySQL: schema, seed. |
| `packages/shared` | Schemas Zod (contrato), constantes, utilitários. |

## Rodando local

```bash
cp .env.example .env            # ajuste se necessário
docker compose up -d            # MySQL 8 na porta 3307
pnpm install
pnpm db:push && pnpm db:seed    # cria tabelas e dados iniciais
pnpm dev:web                    # http://localhost:3001
pnpm dev:mobile                 # Expo (defina EXPO_PUBLIC_API_URL com o IP da máquina)
```

Logins de demonstração (senha `tinypet123`): `admin@tinypet.local`, `tutor@tinypet.local`, `parceiro@tinypet.local`.

## App mobile

- O monorepo usa `node-linker=hoisted` (`.npmrc`), exigido pelo Metro/Expo com pnpm.
- Em dispositivo físico, defina `EXPO_PUBLIC_API_URL` com o IP da máquina (ex.: `http://192.168.0.10:3001`).
- Verificações: `pnpm --filter @tinypet/mobile typecheck` e `npx expo-doctor` em `apps/mobile`.
- Builds de loja via EAS (`eas build`), ainda não configurado.

## Jobs

Endpoints em `/api/v1/jobs/*` protegidos pelo header `x-cron-secret` (`CRON_SECRET`). Agendados em `vercel.json`; em outro host, use cron chamando os endpoints.

## Mídia

Upload direto ao storage (Cloudflare R2 via URL assinada). Sem credenciais R2, os arquivos ficam em `apps/web/public/uploads` (só dev). Processamento com `sharp`: recorte, WebP, miniatura, remoção de EXIF/GPS.

## Pagamentos

Fase 3. Interface `PaymentProvider` em `apps/web/src/server/payments`, adapter Pagar.me v5 e webhook idempotente em `/api/v1/webhooks/pagarme`.

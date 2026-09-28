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
docker compose up -d            # MySQL 8 em 127.0.0.1:3307 (root/tinypet)
pnpm install
pnpm db:push && pnpm db:seed    # cria tabelas e dados iniciais (o seed NÃO roda sozinho em `migrate reset`)
pnpm dev:web                    # http://localhost:3001
pnpm dev:mobile                 # Expo (defina EXPO_PUBLIC_API_URL com o IP da máquina)
```

Logins de demonstração (senha `tinypet123`): `admin@tinypet.local`, `tutor@tinypet.local`, `parceiro@tinypet.local`.

Seed: dados de referência (espécies, raças, categorias, planos, features, badges, skills, marcas, termos, settings) sempre; usuários/parceiro demo só fora de produção (desligue com `SEED_DEMO=0`). Em `NODE_ENV=production` o seed recusa rodar, exceto com `SEED_ALLOW_PRODUCTION=1` (só referência; admin criado apenas se `SEED_ADMIN_PASSWORD` estiver definido) ou `SEED_DEMO=1` (exige `SEED_ADMIN_PASSWORD`).

## Segurança (resumo operacional)

- Produção exige `JWT_SECRET` e `NEXTAUTH_SECRET` fortes (≥ 32 caracteres, não placeholders) — o app não sobe sem eles.
- Rate limit persistido na tabela `rate_limits` (login por e-mail e por IP, cadastro, códigos de verificação). IP: no Vercel usa `x-vercel-forwarded-for`/`x-real-ip`; atrás de proxy próprio defina `TRUST_PROXY=1`; caso contrário o limite vale por chave (e-mail/usuário) apenas.
- CORS por allowlist: `NEXT_PUBLIC_APP_URL` + `CORS_ORIGINS` (localhost só em dev). Requisições com cookie e sem `Authorization: Bearer` que alteram estado precisam de `Origin` permitido e `Content-Type: application/json`.
- App mobile: JWT de 30 dias com `tokenVersion`; `POST /api/v1/auth/logout` e a exclusão de conta invalidam todos os tokens do usuário.

## App mobile

- O monorepo usa `node-linker=hoisted` (`.npmrc`), exigido pelo Metro/Expo com pnpm.
- Em dispositivo físico, defina `EXPO_PUBLIC_API_URL` com o IP da máquina (ex.: `http://192.168.0.10:3001`).
- Verificações: `pnpm --filter @tinypet/mobile typecheck` e `npx expo-doctor` em `apps/mobile`.
- Builds de loja via EAS (`eas build`), ainda não configurado.

## Jobs

Endpoints em `/api/v1/jobs/*` (GET ou POST) protegidos por `CRON_SECRET` — enviado como `Authorization: Bearer <CRON_SECRET>` (o Vercel Cron faz isso automaticamente quando a variável existe no projeto) ou no header `x-cron-secret`. Em produção o segredo precisa ter ≥ 16 caracteres e os placeholders `change-me-cron`/`dev-cron-secret` são rejeitados. Agendados em `vercel.json`; em outro host, use cron chamando os endpoints (ex.: `curl -H "Authorization: Bearer $CRON_SECRET" https://.../api/v1/jobs/overdue`).

> Os agendamentos `*/15` (`/jobs/reminders`) e `*/30` (`/jobs/stories-cleanup`) exigem o plano **Vercel Pro** — no Hobby, crons rodam no máximo uma vez por dia.

## Mídia

Todas as mídias vão para o **AWS S3**: o app e a web enviam direto ao bucket por URL assinada (PUT com `Content-Length` assinado), e a API valida os bytes e processa com `sharp` (recorte, WebP, miniatura, remoção de EXIF/GPS). Em produção, sem `S3_BUCKET` o upload falha. Sem S3 em desenvolvimento, os arquivos ficam em `apps/web/public/uploads`.

Configuração do bucket:
- **Permissões da API** (usuário IAM ou role): `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` no bucket.
- **CORS do bucket**: permitir `PUT` da origem do site (`NEXT_PUBLIC_APP_URL`) com os cabeçalhos `Content-Type` e `Content-Disposition`.
- **Leitura pública** das mídias pelo `S3_PUBLIC_URL` (de preferência CloudFront com o bucket privado via OAC).
- PDFs e vídeos são gravados com `Content-Disposition: attachment`.

## Pagamentos

Fase 3. Interface `PaymentProvider` em `apps/web/src/server/payments`, adapter Pagar.me v5 e webhook idempotente em `/api/v1/webhooks/pagarme`.

O webhook exige HTTP Basic (`PAGARME_WEBHOOK_USER`/`PAGARME_WEBHOOK_PASSWORD`, configurados também no painel do Pagar.me); sem essas variáveis todos os webhooks recebem 401. Corpo limitado a 256 KB. Antes de aplicar `order.paid`, o pedido é consultado na API (`GET /orders/:id`) e precisa estar `paid` com o mesmo valor registrado; se a consulta falhar o erro fica em `webhook_events.error` e o evento não é aplicado (o Pagar.me reenvia).

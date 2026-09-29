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
- Em dispositivo físico, defina `EXPO_PUBLIC_API_URL` com o IP da máquina (ex.: `http://192.168.0.10:3001`). No emulador Android use `http://10.0.2.2:3001`.
- Em desenvolvimento sem S3, as URLs de mídia usam `NEXT_PUBLIC_APP_URL`. Para ver imagens em aparelho/emulador, rode a web com `NEXT_PUBLIC_APP_URL` apontando para o mesmo IP (ex.: `http://192.168.0.10:3001`). Em produção as mídias vêm do S3.
- O app precisa de build de desenvolvimento (`npx expo run:ios` / `npx expo run:android` ou EAS) por causa do módulo nativo de vídeo; não roda no Expo Go.
- iOS com Xcode 26: o plugin `plugins/with-fmt-xcode26.js` corrige a compilação do pod `fmt` do React Native 0.76.
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

**Vídeos** são sempre convertidos **no dispositivo** (web e app) antes do envio: MP4 H.264 + AAC, 1080p ou 720p (1920×1080, 1280×720, 1080×1920 ou 720×1280 — 16:9 ou 9:16), vídeo ≤ 1 Mbps e áudio ≤ 128 kbps (`VIDEO_OUTPUT` em `@tinypet/shared`). Com o limite de 10 MB isso dá ~70 s. Fluxo:
1. Converter o vídeo no dispositivo e escolher a capa (um quadro do vídeo por padrão, ou uma imagem recortada em 16:9/9:16).
2. Enviar a capa com `purpose: "VIDEO_COVER"` e `POST /media/complete { assetId, crop }` (WebP, lado maior 1280 px, sem EXIF).
3. Enviar o vídeo (`POST /media/upload` com `mimeType: "video/mp4"`, `width`, `height`, `durationSeconds`) e fazer o PUT.
4. `POST /media/complete { assetId, coverAssetId }` → o vídeo fica com `thumbUrl` = capa. Trocar depois: `POST /media/:assetId/cover { coverAssetId }`.

A API recusa o que não seguir a regra: no passo 1 (MIME, dimensões declaradas, duração, 10 MB, limites do plano) e no `/media/complete`, lendo o MP4 com `mediabunny` (contêiner MP4, H.264/AAC, dimensões reais iguais às declaradas considerando rotação, bitrate médio medido pelas amostras com 10% de tolerância, duração real). Vídeo recusado é apagado do storage e marcado `REJECTED`; o erro vem em pt-BR com `details.reason` (ver `docs/api-contract.md`, seção Media).

Limites de vídeo por plano (402 `PLAN_LIMIT`): gratuito 1 vídeo/dia e até 30 s; planos pagos 10 vídeos/dia e até 60 s (dia no fuso America/Sao_Paulo; envios pendentes há mais de 1 h não contam). `GET /api/v1/media/limits` informa os limites e o uso do dia.

Fixtures de teste de vídeo: `apps/web/src/server/__fixtures__/generate.sh` (ffmpeg).

## Pagamentos

Fase 3. Interface `PaymentProvider` em `apps/web/src/server/payments`, adapter Pagar.me v5 e webhook idempotente em `/api/v1/webhooks/pagarme`.

O webhook exige HTTP Basic (`PAGARME_WEBHOOK_USER`/`PAGARME_WEBHOOK_PASSWORD`, configurados também no painel do Pagar.me); sem essas variáveis todos os webhooks recebem 401. Corpo limitado a 256 KB. Antes de aplicar `order.paid`, o pedido é consultado na API (`GET /orders/:id`) e precisa estar `paid` com o mesmo valor registrado; se a consulta falhar o erro fica em `webhook_events.error` e o evento não é aplicado (o Pagar.me reenvia).

# tinyPet

Conecta tutores de pets aos profissionais que cuidam deles. Um repositório, **dois projetos**: **tinyPet** (web + API + banco) e **tinyPetApp** (app iOS/Android), mais o pacote `shared` usado pelos dois.

Spec completa: `docs/tinyPet — Especificação do Produto (MVP).md`. Contrato da API: `docs/api-contract.md` (blog: `docs/blog-contract.md`). Deploy: `docs/deploy.md` (EC2 AWS / Oracle Cloud; não usamos Vercel).

## Estrutura

```
tinyPet/                 ← repositório (Yarn workspaces + turbo)
├── tinyPet/             ← PROJETO WEB (@tinypet/web): Next.js 14 — site, área do tutor, painel do parceiro, admin e API REST /api/v1
│   ├── app/ src/        ← páginas, rotas da API, server (src/server), cliente do Prisma (src/db)
│   ├── prisma/          ← BANCO: schema.prisma + seed.ts (só a web acessa o banco)
│   ├── docker-compose.yml  ← MySQL local
│   └── .env             ← variáveis da web/API/Prisma (.env.example)
├── tinyPetApp/          ← PROJETO APP (@tinypet/app): Expo SDK 52 — iOS e Android; só fala com a API via HTTP + JWT
│   └── .env             ← EXPO_PUBLIC_API_URL (.env.example)
├── shared/              ← @tinypet/shared: schemas Zod (= contrato da API), constantes e utils — usado pelos dois
└── docs/                ← spec, contratos da API, deploy
```

- O **app não acessa o banco** nem importa código da web; depende só de `@tinypet/shared` e da API.
- A **web** é dona do banco: schema, seed, migrações e o `PrismaClient` (`import { prisma } from "@/db"`).
- Cada projeto tem o próprio `.env`. Não há `.env` na raiz.

## Rodando local

**tinyPet (web + API + banco)**

```bash
yarn install                          # na raiz: instala os dois projetos + shared
cp tinyPet/.env.example tinyPet/.env  # ajuste se necessário
yarn db:up                            # MySQL 8 em 127.0.0.1:3307 (root/tinypet) — docker compose em tinyPet/
yarn db:push && yarn db:seed          # cria tabelas e dados iniciais (o seed NÃO roda sozinho em `migrate reset`)
yarn dev:web                          # http://localhost:3033
```

**tinyPetApp (iOS/Android)** — precisa da web rodando

```bash
cp tinyPetApp/.env.example tinyPetApp/.env   # EXPO_PUBLIC_API_URL com o IP da máquina
yarn dev:app                                 # Expo (build de desenvolvimento, ver abaixo)
```

Tudo junto: `yarn dev` (turbo). Os scripts `db:*` da raiz repassam para `tinyPet` (`yarn workspace @tinypet/web db:push` etc.).

Logins de demonstração (senha `tinypet123`): `admin@tinypet.local`, `tutor@tinypet.local`, `parceiro@tinypet.local`.

Seed: dados de referência (espécies, raças, categorias, planos, features, badges, skills, marcas, termos, settings) sempre; usuários/parceiro demo só fora de produção (desligue com `SEED_DEMO=0`). Em `NODE_ENV=production` o seed recusa rodar, exceto com `SEED_ALLOW_PRODUCTION=1` (só referência; admin criado apenas se `SEED_ADMIN_PASSWORD` estiver definido) ou `SEED_DEMO=1` (exige `SEED_ADMIN_PASSWORD`).

## Segurança (resumo operacional)

- Produção exige `JWT_SECRET` e `NEXTAUTH_SECRET` fortes (≥ 32 caracteres, não placeholders) — o app não sobe sem eles.
- Rate limit persistido na tabela `rate_limits` (login por e-mail e por IP, cadastro, códigos de verificação). IP: atrás do proxy reverso (nginx/Caddy) defina `TRUST_PROXY=1` — a API usa o primeiro IP de `X-Forwarded-For`, então o proxy deve sobrescrever o header (ver `docs/deploy.md`); sem isso o limite vale por chave (e-mail/usuário) apenas.
- Auditoria de mídia (admin → Auditoria de mídia): denúncias de fotos/vídeos, exclusão real e sanções (conta 7/15/30 dias ou permanente, IP por 7 dias, bloqueio de denúncias). Regras públicas em `/regras-da-comunidade`.
- CORS por allowlist: `NEXT_PUBLIC_APP_URL` + `CORS_ORIGINS` (localhost só em dev). Requisições com cookie e sem `Authorization: Bearer` que alteram estado precisam de `Origin` permitido e `Content-Type: application/json`.
- App mobile: JWT de 30 dias com `tokenVersion`; `POST /api/v1/auth/logout` e a exclusão de conta invalidam todos os tokens do usuário.

## tinyPetApp (app iOS/Android)

- Yarn workspaces instalam as dependências de todos os projetos em `node_modules` na raiz (hoisting), como o Metro/Expo espera. O `metro.config.js` observa a raiz do repositório para resolver `@tinypet/shared`.
- Em dispositivo físico, defina `EXPO_PUBLIC_API_URL` com o IP da máquina (ex.: `http://192.168.0.10:3033`). No emulador Android use `http://10.0.2.2:3033`.
- Em desenvolvimento sem S3, as URLs de mídia usam `NEXT_PUBLIC_APP_URL`. Para ver imagens em aparelho/emulador, rode a web com `NEXT_PUBLIC_APP_URL` apontando para o mesmo IP (ex.: `http://192.168.0.10:3033`). Em produção as mídias vêm do S3.
- O app precisa de build de desenvolvimento (`npx expo run:ios` / `npx expo run:android` ou EAS) por causa do módulo nativo de vídeo; não roda no Expo Go.
- iOS com Xcode 26: o plugin `plugins/with-fmt-xcode26.js` corrige a compilação do pod `fmt` do React Native 0.76.
- Verificações: `yarn workspace @tinypet/app typecheck` e `npx expo-doctor` em `tinyPetApp/`.
- Builds de loja via EAS (`eas build`), ainda não configurado.

## Jobs

Endpoints em `/api/v1/jobs/*` (GET ou POST) protegidos por `CRON_SECRET`, enviado como `Authorization: Bearer <CRON_SECRET>` ou no header `x-cron-secret`. Em produção o segredo precisa ter ≥ 16 caracteres e os placeholders `change-me-cron`/`dev-cron-secret` são rejeitados. Agendados pelo cron do servidor (crontab ou timers systemd) — horários e crontab pronto em `docs/deploy.md`. Rodar um job à mão: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3033/api/v1/jobs/overdue`.

Jobs: `reminders` (15 min), `stories-cleanup` (30 min), `blog-views` (10 min), `blog-publish-scheduled` (5 min), `overdue`, `skill-stats`, `weight-alerts`, `streaks`, `vaccine-reminders` (diários).

## Mídia

Todas as mídias vão para o **AWS S3**: o app e a web enviam direto ao bucket por URL assinada (PUT com `Content-Length` assinado), e a API valida os bytes e processa com `sharp` (recorte, WebP, miniatura, remoção de EXIF/GPS). Em produção, sem `S3_BUCKET` o upload falha. Sem S3 em desenvolvimento, os arquivos ficam em `tinyPet/public/uploads`.

Variáveis: `S3_BUCKET`, `AWS_REGION` (ou `S3_REGION`; padrão `sa-east-1`), `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` (vazias = cadeia padrão de credenciais, ex.: IAM role da EC2; na Oracle Cloud preencha), `S3_PUBLIC_URL` (CloudFront/domínio; padrão `https://<bucket>.s3.<região>.amazonaws.com`) e `S3_ENDPOINT` (só LocalStack/MinIO).

Configuração do bucket:
- **Permissões da API** (usuário IAM ou role): `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` no bucket.
- **CORS do bucket**: permitir `PUT` (upload) e `GET` (botão "Baixar" do visualizador da galeria) da origem do site (`NEXT_PUBLIC_APP_URL`), com os cabeçalhos `Content-Type` e `Content-Disposition`. Sem o `GET`, "Baixar" abre o arquivo numa nova aba.
- **Leitura pública** das mídias pelo `S3_PUBLIC_URL` (de preferência CloudFront com o bucket privado via OAC).
- PDFs e vídeos são gravados com `Content-Disposition: attachment`.

**Fotos da galeria** são recortadas no navegador (1:1, 16:9 ou 9:16) e convertidas para WebP com lado maior ≤ 1920 px antes do upload (`tinyPet/src/lib/image-webp.ts`): HEIC/HEIF é decodificado com `heic2any` e, onde o canvas não gera WebP (Safari), usa o codificador WASM `@jsquash/webp`.

**Vídeos** são sempre convertidos **no dispositivo** (web e app) antes do envio: MP4 H.264 + AAC, 1080p ou 720p (1920×1080, 1280×720, 1080×1920 ou 720×1280 — 16:9 ou 9:16), vídeo ≤ 1 Mbps e áudio ≤ 128 kbps (`VIDEO_OUTPUT` em `@tinypet/shared`). Com o limite de 10 MB isso dá ~70 s. Fluxo:
1. Converter o vídeo no dispositivo e escolher a capa (um quadro do vídeo por padrão, ou uma imagem recortada em 16:9/9:16).
2. Enviar a capa com `purpose: "VIDEO_COVER"` e `POST /media/complete { assetId, crop }` (WebP, lado maior 1280 px, sem EXIF).
3. Enviar o vídeo (`POST /media/upload` com `mimeType: "video/mp4"`, `width`, `height`, `durationSeconds`) e fazer o PUT.
4. `POST /media/complete { assetId, coverAssetId }` → o vídeo fica com `thumbUrl` = capa. Trocar depois: `POST /media/:assetId/cover { coverAssetId }`.

A API recusa o que não seguir a regra: no passo 1 (MIME, dimensões declaradas, duração, 10 MB, limites do plano) e no `/media/complete`, lendo o MP4 com `mediabunny` (contêiner MP4, H.264/AAC, dimensões reais iguais às declaradas considerando rotação, bitrate médio medido pelas amostras com 10% de tolerância, duração real). Vídeo recusado é apagado do storage e marcado `REJECTED`; o erro vem em pt-BR com `details.reason` (ver `docs/api-contract.md`, seção Media).

Limites de vídeo por plano (402 `PLAN_LIMIT`): gratuito 1 vídeo/dia e até 30 s; planos pagos 10 vídeos/dia e até 60 s (dia no fuso America/Sao_Paulo; envios pendentes há mais de 1 h não contam). `GET /api/v1/media/limits` informa os limites e o uso do dia.

Fixtures de teste de vídeo: `tinyPet/src/server/__fixtures__/generate.sh` (ffmpeg).

## Pagamentos

Fase 3. Interface `PaymentProvider` em `tinyPet/src/server/payments`, adapter Pagar.me v5 e webhook idempotente em `/api/v1/webhooks/pagarme`.

O webhook exige HTTP Basic (`PAGARME_WEBHOOK_USER`/`PAGARME_WEBHOOK_PASSWORD`, configurados também no painel do Pagar.me); sem essas variáveis todos os webhooks recebem 401. Corpo limitado a 256 KB. Antes de aplicar `order.paid`, o pedido é consultado na API (`GET /orders/:id`) e precisa estar `paid` com o mesmo valor registrado; se a consulta falhar o erro fica em `webhook_events.error` e o evento não é aplicado (o Pagar.me reenvia).

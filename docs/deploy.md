# tinyPet — Deploy (EC2 AWS / Oracle Cloud)

A web/API roda como processo Node (`next start`, porta 3033) numa VM própria — **AWS EC2** ou **Oracle Cloud (VM/VPS)** — atrás de um proxy reverso (nginx ou Caddy) com TLS. **Não usamos Vercel**: o `vercel.json` foi removido e os jobs rodam pelo cron do sistema.

## Componentes

| Peça | Onde |
| --- | --- |
| Web + API (projeto `tinyPet/`) | VM, `yarn workspace @tinypet/web start` (porta 3033, bloqueada no firewall — acesso só pelo proxy) gerenciado por systemd (ou pm2) |
| Proxy reverso + TLS | nginx (certbot) ou Caddy na mesma VM, portas 80/443 |
| MySQL 8 | AWS RDS / Oracle MySQL HeatWave, ou MySQL na própria VM (não exponha a porta). Schema e seed em `tinyPet/prisma/` |
| Mídia | AWS S3 (+ CloudFront), ver README → Mídia |
| Jobs | `crontab` (ou timers systemd) chamando `/api/v1/jobs/*` |
| tinyPetApp | Não vai para o servidor: EAS Build/lojas, com `EXPO_PUBLIC_API_URL=https://<domínio>` em `tinyPetApp/.env` ou no perfil do EAS |

## Coolify

O repositório tem um `Dockerfile` na raiz (web + API; o app mobile não entra na imagem) e `GET /api/health` (verifica o banco).

1. **Banco:** em *Resources → New → Database → MySQL 8*. Anote a URL interna (`mysql://user:senha@<host-interno>:3306/<db>`) e ative backups agendados.
2. **Aplicação:** *New → Application → GitHub* (repo privado: GitHub App ou deploy key), branch `master`.
   - Build Pack: **Dockerfile** · Base Directory: `/` · Dockerfile: `/Dockerfile`
   - Porta exposta: **3033** · Domínio: `https://seu-dominio` (Coolify emite o certificado)
   - Health check: caminho `/api/health`, porta 3033
   - Servidor com **≥ 4 GB de RAM** para o `next build` (ou build em outro servidor)
3. **Variáveis de ambiente** (aba *Environment Variables*). Marque **Build Variable** em `NEXT_PUBLIC_APP_URL`, `S3_BUCKET`, `S3_PUBLIC_URL` e `AWS_REGION` (entram no bundle do navegador e no `next.config`).

   | Variável | Valor |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | URL interna do MySQL do Coolify |
   | `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL` | `https://seu-dominio` |
   | `NEXTAUTH_SECRET`, `JWT_SECRET` | ≥ 32 caracteres (`openssl rand -base64 48`) — o app não sobe sem eles |
   | `CRON_SECRET` | `openssl rand -hex 32` |
   | `TRUST_PROXY` | `1` (o proxy do Coolify — Traefik/Caddy — define o IP real) |
   | `S3_BUCKET`, `AWS_REGION` (ou `S3_REGION`), `S3_PUBLIC_URL` | bucket de mídia (obrigatório em produção) |
   | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | usuário IAM com Put/Get/DeleteObject no bucket (fora da AWS não há IAM role) |
   | `SMTP_URL`, `EMAIL_FROM` | e-mail transacional (sem isso os e-mails são descartados em produção) |
   | `DB_PUSH_ON_START` | `1` para aplicar o schema ao iniciar (enquanto não houver `prisma/migrations`) |
   | Opcionais | `API_NINJAS_KEY`, `GOOGLE_MAPS_API_KEY`, `GOOGLE_CLIENT_ID/SECRET`, `APPLE_CLIENT_ID/SECRET`, `PAGARME_*`, `CORS_ORIGINS`, `BLOG_VIEW_SALT` |

4. **Primeiro deploy / seed:** com `DB_PUSH_ON_START=1` o container cria as tabelas. Depois, no *Terminal* do container: `cd /app && SEED_ALLOW_PRODUCTION=1 SEED_ADMIN_EMAIL=admin@seu-dominio SEED_ADMIN_PASSWORD='senha-forte' yarn db:seed` (dados de referência + admin; sem usuários demo).
5. **Jobs:** aba *Scheduled Tasks* da aplicação, uma tarefa por job (roda dentro do container; `CRON_SECRET` já está no ambiente). Comando: `curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3033/api/v1/jobs/<job>` com os horários da tabela de Jobs abaixo (UTC).
6. **S3:** CORS do bucket liberando `PUT` e `GET` para `https://seu-dominio` (ver README → Mídia).
7. **Webhook Pagar.me** (quando usar): `https://seu-dominio/api/v1/webhooks/pagarme` com HTTP Basic.

`DB_PUSH_ON_START` usa `prisma db push` **sem** `--accept-data-loss`: mudanças destrutivas fazem o container falhar ao iniciar em vez de apagar dados. Recomendado: criar a migração inicial (`prisma migrate`) e trocar por `migrate deploy`.

## Build e start

```bash
# Node 20 LTS + Yarn 1 (npm i -g yarn)
# Só a web vai para o servidor; o tinyPetApp é publicado nas lojas via EAS.
yarn install --frozen-lockfile        # Yarn 1 instala o workspace inteiro (o app não roda no servidor)
yarn db:generate
yarn db:push                        # ainda não há tinyPet/prisma/migrations; quando houver: yarn workspace @tinypet/web db:migrate:deploy
yarn workspace @tinypet/web build
yarn workspace @tinypet/web start    # next start -p 3033
```

Nunca rode `yarn db:migrate` (`prisma migrate dev`) em produção.

O `.env` fica em `tinyPet/.env` (ver `tinyPet/.env.example`) — lido pelo Next.js e pelo Prisma CLI. Em produção são obrigatórios `NODE_ENV=production`, `JWT_SECRET`/`NEXTAUTH_SECRET` fortes, `NEXTAUTH_URL`/`NEXT_PUBLIC_APP_URL` com o domínio HTTPS, `S3_BUCKET`, `CRON_SECRET` e `TRUST_PROXY=1`. Seed em produção: ver README → Rodando local.

Exemplo de unit systemd (`/etc/systemd/system/tinypet-web.service`):

```ini
[Unit]
Description=tinyPet web/API
After=network.target

[Service]
User=tinypet
# raiz do repositório (workspace Yarn); o .env fica em tinyPet/
WorkingDirectory=/srv/tinypet
EnvironmentFile=/srv/tinypet/tinyPet/.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/env yarn workspace @tinypet/web start
Restart=always

[Install]
WantedBy=multi-user.target
```

## Proxy reverso

- Defina `TRUST_PROXY=1` — obrigatório também para o **bloqueio de IP** da auditoria de mídia (sem ele o IP é desconhecido e não é gravado nem bloqueado). A API usa o **primeiro** IP de `X-Forwarded-For` (rate limit por IP, auditoria), então o proxy precisa **sobrescrever** o header com o IP real do cliente — nunca repassar o valor recebido. Sem `TRUST_PROXY`, o limite por IP vira um limite global por chave.
- Upload de mídia vai direto ao S3; pela API só passam multipart do blog (≤ 10 MB) e importação de clientes (CSV). `client_max_body_size 12m` basta.

```nginx
server {
  listen 443 ssl http2;
  server_name tinypet.com.br;
  # ssl_certificate ... (certbot)

  client_max_body_size 12m;

  location / {
    proxy_pass http://127.0.0.1:3033;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;   # sobrescreve, não usa $proxy_add_x_forwarded_for
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Com um load balancer na frente (AWS ALB / OCI LB), o nginx deve confiar só no LB (`set_real_ip_from <faixa do LB>; real_ip_header X-Forwarded-For;`) e repassar `$remote_addr` já resolvido.

## Jobs (cron)

Todos os endpoints `/api/v1/jobs/*` aceitam GET ou POST com `Authorization: Bearer <CRON_SECRET>` (ou `x-cron-secret`). Chame pelo `127.0.0.1:3033` para não depender do DNS/TLS. Horários em UTC (a VM deve estar em UTC).

```cron
# crontab -e  (usuário tinypet). Variáveis do crontab não expandem outras variáveis; a linha de comando (sh) sim.
CRON_SECRET=troque-pelo-segredo
JOBS=http://127.0.0.1:3033/api/v1/jobs

*/5  * * * * curl -fsS -m 300 -X POST -H "Authorization: Bearer $CRON_SECRET" $JOBS/blog-publish-scheduled >/dev/null
*/10 * * * * curl -fsS -m 300 -X POST -H "Authorization: Bearer $CRON_SECRET" $JOBS/blog-views >/dev/null
*/15 * * * * curl -fsS -m 300 -X POST -H "Authorization: Bearer $CRON_SECRET" $JOBS/reminders >/dev/null
*/30 * * * * curl -fsS -m 300 -X POST -H "Authorization: Bearer $CRON_SECRET" $JOBS/stories-cleanup >/dev/null
5  3 * * *   curl -fsS -m 300 -X POST -H "Authorization: Bearer $CRON_SECRET" $JOBS/overdue >/dev/null
30 3 * * *   curl -fsS -m 300 -X POST -H "Authorization: Bearer $CRON_SECRET" $JOBS/skill-stats >/dev/null
0  4 * * *   curl -fsS -m 300 -X POST -H "Authorization: Bearer $CRON_SECRET" $JOBS/weight-alerts >/dev/null
10 4 * * *   curl -fsS -m 300 -X POST -H "Authorization: Bearer $CRON_SECRET" $JOBS/streaks >/dev/null
0  9 * * *   curl -fsS -m 300 -X POST -H "Authorization: Bearer $CRON_SECRET" $JOBS/vaccine-reminders >/dev/null
```

Proteja o crontab (contém o segredo) ou use timers systemd com `EnvironmentFile=/srv/tinypet/tinyPet/.env`.

| Job | Frequência | O que faz |
| --- | --- | --- |
| `reminders` | 15 min | Lembretes de atendimento (24 h e 2 h antes, CONFIRMED) e de parcela que vence amanhã |
| `stories-cleanup` | 30 min | Soft delete de stories expirados (24 h) |
| `blog-views` | 10 min | Consolida visualizações do blog (`BlogPostDailyStat`) |
| `blog-publish-scheduled` | 5 min | Publica posts agendados |
| `overdue` | diário 03:05 | Parcelas vencidas → OVERDUE |
| `skill-stats` | diário 03:30 | Estatísticas de habilidades |
| `weight-alerts` | diário 04:00 | Variação de peso acima de `weight_alert` → avisa tutor e clínicas vinculadas |
| `streaks` | diário 04:10 | Zera sequência de quem perdeu tarefa ontem; badge de vacinas em dia |
| `vaccine-reminders` | diário 09:00 | Vacinas/vermífugos que vencem em 7 dias → avisa o tutor |

## S3 a partir da VM

- **EC2:** anexe uma IAM role à instância com `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` no bucket e deixe `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` vazios (cadeia padrão de credenciais).
- **Oracle Cloud:** não há role AWS — crie um usuário IAM com a mesma política e preencha `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`. `AWS_REGION` (ou `S3_REGION`) = região do bucket.

## Checklist

- [ ] `.env` de produção completo, segredos gerados (`openssl rand -base64 48`, `openssl rand -hex 32`).
- [ ] Porta 3033 e MySQL fechadas no security group / security list; só 80/443 (e SSH restrito) abertos.
- [ ] `TRUST_PROXY=1` e proxy sobrescrevendo `X-Forwarded-For`.
- [ ] Crontab instalado e testado (`curl` manual de um job retorna `{ ok: true }`).
- [ ] CORS do bucket S3 permite `PUT` da origem `NEXT_PUBLIC_APP_URL`.
- [ ] Webhook Pagar.me apontando para `https://<domínio>/api/v1/webhooks/pagarme` com HTTP Basic.
- [ ] Backup do MySQL (snapshot RDS/HeatWave ou `mysqldump` agendado).

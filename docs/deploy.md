# tinyPet — Deploy (EC2 AWS / Oracle Cloud)

A web/API roda como processo Node (`next start`, porta 3033) numa VM própria — **AWS EC2** ou **Oracle Cloud (VM/VPS)** — atrás de um proxy reverso (nginx ou Caddy) com TLS. **Não usamos Vercel**: o `vercel.json` foi removido e os jobs rodam pelo cron do sistema.

## Componentes

| Peça | Onde |
| --- | --- |
| Web + API (projeto `tinyPet/`) | VM, `pnpm --filter @tinypet/web start` (porta 3033, bloqueada no firewall — acesso só pelo proxy) gerenciado por systemd (ou pm2) |
| Proxy reverso + TLS | nginx (certbot) ou Caddy na mesma VM, portas 80/443 |
| MySQL 8 | AWS RDS / Oracle MySQL HeatWave, ou MySQL na própria VM (não exponha a porta). Schema e seed em `tinyPet/prisma/` |
| Mídia | AWS S3 (+ CloudFront), ver README → Mídia |
| Jobs | `crontab` (ou timers systemd) chamando `/api/v1/jobs/*` |
| tinyPetApp | Não vai para o servidor: EAS Build/lojas, com `EXPO_PUBLIC_API_URL=https://<domínio>` em `tinyPetApp/.env` ou no perfil do EAS |

## Build e start

```bash
# Node 20 LTS + pnpm 10 (corepack enable)
# Só a web vai para o servidor; o tinyPetApp é publicado nas lojas via EAS.
pnpm install --frozen-lockfile --filter @tinypet/web...
pnpm db:generate
pnpm db:push                        # ainda não há tinyPet/prisma/migrations; quando houver: pnpm --filter @tinypet/web db:migrate:deploy
pnpm --filter @tinypet/web build
pnpm --filter @tinypet/web start    # next start -p 3033
```

Nunca rode `pnpm db:migrate` (`prisma migrate dev`) em produção.

O `.env` fica em `tinyPet/.env` (ver `tinyPet/.env.example`) — lido pelo Next.js e pelo Prisma CLI. Em produção são obrigatórios `NODE_ENV=production`, `JWT_SECRET`/`NEXTAUTH_SECRET` fortes, `NEXTAUTH_URL`/`NEXT_PUBLIC_APP_URL` com o domínio HTTPS, `S3_BUCKET`, `CRON_SECRET` e `TRUST_PROXY=1`. Seed em produção: ver README → Rodando local.

Exemplo de unit systemd (`/etc/systemd/system/tinypet-web.service`):

```ini
[Unit]
Description=tinyPet web/API
After=network.target

[Service]
User=tinypet
# raiz do repositório (pnpm workspace); o .env fica em tinyPet/
WorkingDirectory=/srv/tinypet
EnvironmentFile=/srv/tinypet/tinyPet/.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/env pnpm --filter @tinypet/web start
Restart=always

[Install]
WantedBy=multi-user.target
```

## Proxy reverso

- Defina `TRUST_PROXY=1`. A API usa o **primeiro** IP de `X-Forwarded-For` (rate limit por IP, auditoria), então o proxy precisa **sobrescrever** o header com o IP real do cliente — nunca repassar o valor recebido. Sem `TRUST_PROXY`, o limite por IP vira um limite global por chave.
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

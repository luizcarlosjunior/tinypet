# tinyPet web + API (tinyPet/) — production image for Coolify / any Docker host.
# Build context = repository root (Yarn 1 workspaces). The mobile app (tinyPetApp) is not built here.
FROM node:22-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
# openssl: Prisma engines · curl: health checks and scheduled jobs (cron) inside the container
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
# Manifests first so dependency installation is cached between deploys
COPY package.json yarn.lock ./
COPY tinyPet/package.json tinyPet/package.json
COPY tinyPet/scripts tinyPet/scripts
COPY tinyPetApp/package.json tinyPetApp/package.json
COPY shared/package.json shared/package.json
RUN yarn install --frozen-lockfile --network-timeout 600000
COPY . .
# NEXT_PUBLIC_* are inlined into the browser bundle at build time: pass them as build args (Coolify "Build Variable").
ARG NEXT_PUBLIC_APP_URL
ARG S3_BUCKET
ARG S3_PUBLIC_URL
ARG AWS_REGION
ARG NEXT_PUBLIC_RECAPTCHA_SITE_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL S3_BUCKET=$S3_BUCKET S3_PUBLIC_URL=$S3_PUBLIC_URL AWS_REGION=$AWS_REGION NEXT_PUBLIC_RECAPTCHA_SITE_KEY=$NEXT_PUBLIC_RECAPTCHA_SITE_KEY
# webpack cache (~600 MB) is useless at runtime: drop it so it never reaches the image
RUN yarn workspace @tinypet/web db:generate && yarn workspace @tinypet/web build && rm -rf tinyPet/.next/cache && mkdir -p tinyPet/.next/cache

FROM base AS runtime
ENV NODE_ENV=production PORT=3033
# --chown in the COPY (a later `chown -R` would duplicate every file into a new layer)
COPY --from=build --chown=node:node /app /app
RUN chmod +x /app/tinyPet/scripts/docker-start.sh
USER node
EXPOSE 3033
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 CMD curl -fsS http://127.0.0.1:3033/api/health || exit 1
CMD ["/app/tinyPet/scripts/docker-start.sh"]

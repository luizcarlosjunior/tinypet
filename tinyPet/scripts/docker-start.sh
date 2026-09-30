#!/bin/sh
# Container entrypoint (Dockerfile). Optionally syncs the schema, then starts Next on $PORT (3033).
set -e
cd /app/tinyPet
if [ "${DB_PUSH_ON_START:-0}" = "1" ]; then
  # No prisma/migrations yet: `db push` applies additive changes and REFUSES destructive ones (no --accept-data-loss).
  echo "[start] prisma db push"
  npx prisma db push --skip-generate
fi
exec npx next start -p "${PORT:-3033}" -H 0.0.0.0

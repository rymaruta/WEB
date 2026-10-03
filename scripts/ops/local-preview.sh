#!/usr/bin/env bash
# 手元で本番と同じ形（standalone）を動かす。Postgres を起こし、移行し、ビルドして 3102 番で起動する
# 使い方: scripts/ops/local-preview.sh [--no-build]
set -euo pipefail
source "$(dirname "$0")/env.sh"
cd "$(dirname "$0")/../.."
PGBIN=/usr/lib/postgresql/16/bin
if ! $PGBIN/pg_isready -h /tmp -p 55432 -q; then
  su postgres -c "$PGBIN/pg_ctl -D /var/tmp/znpg -o '-p 55432 -k /tmp' -l /var/tmp/znpg/log start" >/dev/null
  until $PGBIN/pg_isready -h /tmp -p 55432 -q; do sleep 1; done
fi
export DATABASE_URL=$ZN_LOCAL_DB CRON_SECRET=localtest
npx prisma migrate deploy >/dev/null
if [ "${1:-}" != --no-build ]; then
  npm run build >"$ZN_SCRATCH/build.log" 2>&1 || { tail -30 "$ZN_SCRATCH/build.log"; exit 1; }
  cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
fi
pkill -f "standalone/server.js" 2>/dev/null || true
(cd .next/standalone && PORT=3102 HOSTNAME=127.0.0.1 nohup node server.js >"$ZN_SCRATCH/server.log" 2>&1 &)
until curl -s -o /dev/null http://127.0.0.1:3102/; do sleep 1; done
echo "http://127.0.0.1:3102 （管理 API は Bearer localtest）"

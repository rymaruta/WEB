#!/usr/bin/env bash
# マージ後の確認：本番に反映されるのを待ち、CloudFront のキャッシュを消し、主なページの応答を確かめる
# 使い方: scripts/ops/deploy-verify.sh <マージのコミット（先頭8字以上）> [確かめるパス ...]
set -euo pipefail
source "$(dirname "$0")/env.sh"
sha=${1:?コミットを指定してください}; shift || true
short=${sha:0:8}
for i in $(seq 1 75); do
  if curl -s "$ZN_ORIGIN/" | grep -q "dpl=$short"; then echo "deployed $short"; break; fi
  [ "$i" = 75 ] && { echo "反映されませんでした（25分）。GitHub Actions の deploy-aws を確かめてください"; exit 1; }
  sleep 20
done
id=$(aws cloudfront create-invalidation --distribution-id "$ZN_CF_DIST" --paths "/*" --query Invalidation.Id --output text)
until [ "$(aws cloudfront get-invalidation --distribution-id "$ZN_CF_DIST" --id "$id" --query Invalidation.Status --output text)" = Completed ]; do sleep 10; done
echo "invalidated"
for p in / /ranking /compare "$@"; do printf '%-24s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' "$ZN_SITE$p?v=$RANDOM")"; done
S=$(zn_secret); printf '%-24s %s\n' "admin api" "$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $S" "$ZN_ORIGIN/api/admin/breaking")"

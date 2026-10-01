# 本番用イメージ（AWS Lightsail のコンテナサービスで動かす）。
# ビルドはデータベースへの接続が必要なため、Docker の外（GitHub Actions）で `next build` を行い、
# .next/standalone に .next/static と public をコピーしてから、このイメージに詰める。
# 手順は .github/workflows/deploy-aws.yml を参照。
FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

WORKDIR /app
COPY --chown=node:node .next/standalone ./

USER node
EXPOSE 3000
CMD ["node", "server.js"]

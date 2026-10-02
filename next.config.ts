import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // AWS（Lightsail のコンテナ）では .next/standalone の最小構成を Docker イメージに入れて動かす
  output: "standalone",
  // 公開ごとの ID（GitHub Actions のコミット）。古い画面のまま新しい版のサーバーへ移ろうとしたときに、
  // 自動でページを読み直して、部品の食い違いによるエラーを防ぐ（https://nextjs.org/docs/app/guides/self-hosting#version-skew）
  deploymentId: process.env.NEXT_DEPLOYMENT_ID || undefined,
  images: {
    // 媒体の画像（https のみ）を縮小して配信する。媒体は数が多く入れ替わるためホストは限定しない
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    // 作る大きさと画質を絞り、縮小の処理と保存を増やしすぎない
    deviceSizes: [640, 828, 1080],
    imageSizes: [256, 384],
    qualities: [60],
    formats: ["image/webp"],
    // 縮小版を1日保存する（CDN もこの期間キャッシュする）
    minimumCacheTTL: 86_400,
    maximumRedirects: 3,
  },
  async redirects() {
    return [
      // ジャンルの2ページ目以降は /genre/[slug]/more に移した（以前の ?page= の URL を引き継ぐ。クエリはそのまま渡る）
      { source: "/genre/:slug", has: [{ type: "query", key: "page" }], destination: "/genre/:slug/more", permanent: true },
    ];
  },
  experimental: {
    serverActions: {
      // CloudFront 経由だと x-forwarded-host が Lightsail のホスト名になり、
      // ブラウザの Origin（zenbu-navi.com）と一致せずフォーム送信が拒否されるため、公開ドメインを許可する
      allowedOrigins: ["zenbu-navi.com", "www.zenbu-navi.com"],
    },
  },
};

export default nextConfig;

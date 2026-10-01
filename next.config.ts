import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // AWS（Lightsail のコンテナ）では .next/standalone の最小構成を Docker イメージに入れて動かす
  output: "standalone",
  experimental: {
    serverActions: {
      // CloudFront 経由だと x-forwarded-host が Lightsail のホスト名になり、
      // ブラウザの Origin（zenbu-navi.com）と一致せずフォーム送信が拒否されるため、公開ドメインを許可する
      allowedOrigins: ["zenbu-navi.com", "www.zenbu-navi.com"],
    },
  },
};

export default nextConfig;

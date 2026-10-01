import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // AWS（Lightsail のコンテナ）では .next/standalone の最小構成を Docker イメージに入れて動かす
  output: "standalone",
};

export default nextConfig;

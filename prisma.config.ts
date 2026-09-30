import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // マイグレーションは接続プールを経由しない直接接続で行う（Neon 連携では DATABASE_URL_UNPOOLED が自動設定される）
    url: process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"],
  },
});

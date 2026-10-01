import { PrismaPg } from "@prisma/adapter-pg";
import type { PoolConfig } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { RDS_CA_AP_NORTHEAST_1 } from "./rds-ca";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * 接続設定。AWS の DB（*.rds.amazonaws.com）は、証明書を検証したうえで暗号化して接続する。
 * 接続文字列の sslmode は検証の設定を上書きしてしまうため取り除き、ssl で指定する
 */
export function poolConfig(connectionString: string): PoolConfig {
  const url = new URL(connectionString);
  if (!url.hostname.endsWith(".rds.amazonaws.com")) return { connectionString };
  for (const key of ["sslmode", "sslaccept", "sslcert", "uselibpqcompat"]) url.searchParams.delete(key);
  return { connectionString: url.toString(), ssl: { ca: RDS_CA_AP_NORTHEAST_1, rejectUnauthorized: true } };
}

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL が設定されていません");
  }
  return new PrismaClient({ adapter: new PrismaPg(poolConfig(connectionString)) });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

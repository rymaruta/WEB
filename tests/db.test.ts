import { describe, expect, it } from "vitest";
import { poolConfig } from "@/lib/db-config";

describe("poolConfig", () => {
  it("AWS の DB は証明書を検証して接続する（sslmode は取り除く）", () => {
    const c = poolConfig("postgresql://u:p@ls-abc.crqi4m8kgvb0.ap-northeast-1.rds.amazonaws.com:5432/db?sslmode=require");
    expect(c.connectionString).toBe("postgresql://u:p@ls-abc.crqi4m8kgvb0.ap-northeast-1.rds.amazonaws.com:5432/db");
    expect(c.ssl).toMatchObject({ rejectUnauthorized: true });
    expect(String((c.ssl as { ca: string }).ca)).toContain("BEGIN CERTIFICATE");
  });
  it("それ以外の DB は接続文字列のまま", () => {
    const s = "postgresql://u:p@ep-x-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require";
    expect(poolConfig(s)).toEqual({ connectionString: s });
  });
});

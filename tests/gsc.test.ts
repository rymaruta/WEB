import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { reportRange, signJwt } from "@/lib/gsc";

describe("signJwt", () => {
  it("サービスアカウントの鍵で検証できる RS256 の JWT を作る", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const jwt = signJwt({ client_email: "a@b.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString() }, 1_700_000_000_000);
    const [h, c, sig] = jwt.split(".");
    const claim = JSON.parse(Buffer.from(c, "base64url").toString());
    expect(claim).toMatchObject({ iss: "a@b.iam.gserviceaccount.com", iat: 1_700_000_000, exp: 1_700_003_600 });
    expect(claim.scope).toContain("webmasters.readonly");
    const v = createVerify("RSA-SHA256");
    v.update(`${h}.${c}`);
    expect(v.verify(publicKey, Buffer.from(sig, "base64url"))).toBe(true);
  });
});

describe("reportRange", () => {
  it("今日から2日前までの確定済みの日数分（日本時間）", () => {
    expect(reportRange(7, new Date("2026-10-01T12:00:00Z"))).toEqual({ start: "2026-09-23", end: "2026-09-29" });
  });
});

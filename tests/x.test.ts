import { describe, expect, it } from "vitest";
import { authorizationHeader, percentEncode, signature } from "@/lib/x/oauth1";

describe("OAuth 1.0a の署名", () => {
  it("X（旧 Twitter）の公式ドキュメントの例と同じ署名になる", () => {
    const sig = signature(
      "POST",
      "https://api.twitter.com/1.1/statuses/update.json",
      {
        include_entities: "true",
        status: "Hello Ladies + Gentlemen, a signed OAuth request!",
        oauth_consumer_key: "xvz1evFS4wEEPTGEFPHBog",
        oauth_nonce: "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg",
        oauth_signature_method: "HMAC-SHA1",
        oauth_timestamp: "1318622958",
        oauth_token: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb",
        oauth_version: "1.0",
      },
      "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw",
      "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE",
    );
    expect(sig).toBe("hCtSmYh+iHYCEqBWrE7C7hYmtUk=");
  });
  it("RFC 3986 のエンコード", () => {
    expect(percentEncode("Ladies + Gentlemen!*")).toBe("Ladies%20%2B%20Gentlemen%21%2A");
  });
  it("ヘッダーに必要な項目がそろう", () => {
    const h = authorizationHeader("POST", "https://api.x.com/2/tweets", { consumerKey: "ck", consumerSecret: "cs", token: "t", tokenSecret: "ts" }, 1_700_000_000_000, "n");
    expect(h).toMatch(/^OAuth /);
    for (const k of ["oauth_consumer_key", "oauth_nonce", "oauth_signature", "oauth_signature_method", "oauth_timestamp", "oauth_token", "oauth_version"]) expect(h).toContain(`${k}=`);
  });
});

describe("notifyOwner", () => {
  it("宛先か送信用の鍵がなければ何もしない", async () => {
    const { notifyOwner } = await import("@/lib/notify");
    expect(await notifyOwner({ title: "t", what: "w" }, {})).toBe(false);
    expect(await notifyOwner({ title: "t", what: "w" }, { NOTIFY_EMAIL: "a@example.com" })).toBe(false);
    expect(await notifyOwner({ title: "t", what: "w" }, { NOTIFY_EMAIL: "PLACEHOLDER", SES_ACCESS_KEY_ID: "x", SES_SECRET_ACCESS_KEY: "y" })).toBe(false);
  });
});

describe("通知メールの本文", () => {
  it("件名・対応・管理画面への案内をそろえ、HTML はエスケープする", async () => {
    const { noticeText, noticeHtml } = await import("@/lib/notify");
    const n = { title: "夜のニュースを見送りました", what: "<b>理由</b>", action: "不要です。" };
    expect(noticeText(n)).toContain("対応：不要です。");
    expect(noticeText(n)).toContain("https://zenbu-navi.com/admin");
    expect(noticeHtml(n)).toContain("&lt;b&gt;理由&lt;/b&gt;");
    expect(noticeHtml(n)).toContain("管理画面を開く");
  });
});

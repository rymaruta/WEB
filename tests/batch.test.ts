import { describe, expect, it, vi } from "vitest";

// 送り先の処理（DB）には接続しない
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const req = (body: unknown, auth = "Bearer test-secret") =>
  new Request("https://example.com/api/admin/batch", { method: "POST", headers: { authorization: auth, "content-type": "application/json" }, body: JSON.stringify(body) });

describe("まとめて送る窓口", () => {
  it("合言葉がなければ断る", async () => {
    process.env.CRON_SECRET = "test-secret";
    const { POST } = await import("@/app/api/admin/batch/route");
    expect((await POST(req({ items: [] }, "Bearer wrong"))).status).toBe(401);
  });
  it("送り先の形が違う・件数が多すぎる・空なら 400", async () => {
    process.env.CRON_SECRET = "test-secret";
    const { POST } = await import("@/app/api/admin/batch/route");
    expect((await POST(req({ items: [{ path: "tasks/abc", body: {} }] }))).status).toBe(400);
    expect((await POST(req({ items: [{ path: "stories/../x", body: {} }] }))).status).toBe(400);
    expect((await POST(req({ items: Array.from({ length: 51 }, () => ({ path: "games/1", body: {} })) }))).status).toBe(400);
    expect((await POST(req({ items: [] }))).status).toBe(400);
  });
  it("項目ごとに1件ずつの窓口と同じ検証をする（形の違う結果は、その項目だけ 400）", async () => {
    process.env.CRON_SECRET = "test-secret";
    const { POST } = await import("@/app/api/admin/batch/route");
    const res = await POST(req({ items: [{ path: "games/1", body: { result: { wrong: true } } }] }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.failed).toBe(1);
    expect(json.results[0].status).toBe(400);
  });
});

describe("解析待ちの一覧を短くする", () => {
  it("?compact=1 のときだけ、執筆ルールと出力形式を省く（一段下も）", async () => {
    const { compactPending } = await import("@/lib/admin/compact");
    const body = { instructions: "x", outputSchema: {}, items: [1], stories: { instructions: "y", outputSchema: {}, items: [2] } };
    expect(compactPending(new Request("https://e.com/p?compact=1"), body)).toEqual({ items: [1], stories: { items: [2] } });
    expect(compactPending(new Request("https://e.com/p"), body)).toBe(body);
  });
});

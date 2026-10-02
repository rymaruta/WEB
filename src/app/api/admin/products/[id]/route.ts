import { hasCronSecret } from "@/lib/auth";
import { ProductExtractSchema, saveProductExtract } from "@/lib/products";

export const dynamic = "force-dynamic";

/** 新商品の発売の読み取り結果を受け取り、資料と照合して保存する */
export async function POST(request: Request, { params }: RouteContext<"/api/admin/products/[id]">) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "invalid id" }, { status: 400 });
  const body = (await request.json().catch(() => null)) as { result?: unknown } | null;
  const parsed = ProductExtractSchema.safeParse(body?.result);
  if (!parsed.success) return Response.json({ error: "invalid result", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  try {
    const { saved } = await saveProductExtract(id, parsed.data);
    return Response.json({ status: saved ? "saved" : "checked", product: saved });
  } catch {
    return Response.json({ error: "topic not found" }, { status: 404 });
  }
}

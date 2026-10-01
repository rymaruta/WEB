import { siteConfig } from "@/config/site";

export const dynamic = "force-static";

/** ads.txt: このサイトの広告枠を販売してよい事業者の宣言（Google AdSense） */
export function GET() {
  const id = siteConfig.adsenseClient.replace(/^ca-/, "");
  const body = id ? `google.com, ${id}, DIRECT, f08c47fec0942fa0\n` : "";
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

/** 管理画面をホーム画面に追加したときの設定（開くと管理画面が出る。サイトの「ぜんぶナビ」とは別のアイコン名にする） */
export const dynamic = "force-static";

export function GET() {
  return Response.json(
    {
      name: "ぜんぶナビ 管理",
      short_name: "ナビ管理",
      start_url: "/admin",
      scope: "/admin",
      display: "standalone",
      background_color: "#f6f6f4",
      theme_color: "#d9381e",
      lang: "ja",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    },
    { headers: { "content-type": "application/manifest+json" } },
  );
}

import { ImageResponse } from "next/og";
import { siteConfig } from "@/config/site";
import { loadJapaneseFont } from "./og-font";

export const OG_SIZE = { width: 1200, height: 630 };

const ACCENT = "#d9381e";

/** ジャンルの色（globals.css のライトテーマと同じ値） */
const GENRE_COLORS: Record<string, string> = {
  domestic: "#2563eb",
  world: "#0e7490",
  business: "#047857",
  tech: "#7c3aed",
  entertainment: "#db2777",
  sports: "#ea580c",
  game: "#4f46e5",
  anime: "#c026d3",
  products: "#b45309",
  life: "#0d9488",
};

type Props = {
  title: string;
  /** 見出しの上に出すラベル（ジャンル名など） */
  label?: string;
  genreSlug?: string;
  /** 下段に出す補足（「5媒体が報道」など） */
  note?: string;
};

/** SNS でシェアされたときの画像（1200x630）。日本語フォントが取れなければ、ロゴだけの画像にする */
export async function renderOgCard({ title, label, genreSlug, note }: Props) {
  const color = (genreSlug && GENRE_COLORS[genreSlug]) || ACCENT;
  const text = [siteConfig.name, siteConfig.tagline, title, label ?? "", note ?? ""].join("");
  const font = await loadJapaneseFont(text, 700);
  const clipped = title.length > 64 ? `${title.slice(0, 63)}…` : title;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#f6f6f4" }}>
        <div style={{ height: 18, background: color, display: "flex" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "56px 72px 48px" }}>
          {font && label && (
            <div style={{ display: "flex" }}>
              <div style={{ background: color, color: "#fff", fontSize: 30, padding: "6px 22px", borderRadius: 999 }}>{label}</div>
            </div>
          )}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              fontSize: clipped.length > 40 ? 54 : 64,
              lineHeight: 1.35,
              color: "#1c1c1a",
              fontWeight: 700,
              // 改行を入れた見出し（配信ページの見出しの一覧など）は、その位置で折り返す
              whiteSpace: "pre-wrap",
            }}
          >
            {font ? clipped : ""}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <svg width="64" height="64" viewBox="0 0 32 32">
                <rect width="32" height="32" rx="8" fill={ACCENT} />
                <rect x="7" y="8" width="18" height="4" rx="2" fill="white" />
                <rect x="7" y="14.5" width="13" height="3.5" rx="1.75" fill="white" opacity="0.85" />
                <rect x="7" y="20.5" width="16" height="3.5" rx="1.75" fill="white" opacity="0.65" />
              </svg>
              {font && <div style={{ fontSize: 40, color: "#1c1c1a", fontWeight: 700 }}>{siteConfig.name}</div>}
            </div>
            {font && note && <div style={{ fontSize: 32, color: ACCENT, fontWeight: 700 }}>{note}</div>}
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: font ? [{ name: "Noto Sans JP", data: font, weight: 700, style: "normal" }] : undefined },
  );
}

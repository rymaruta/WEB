import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import { siteConfig } from "@/config/site";
import { loadGoogleFont } from "@/lib/og-font";
import { FOLLOWUP_COLOR, INK, type BreakingCard, type Card, type FollowupCard, type IndexCard, type NewsCard } from "./compose";

/**
 * ダイジェストのカード画像（1080×1080）。デザインは仕様書 v2 の「Kaname」。
 * 縦を3帯に分ける: 上（補足）・中央（見出しと要点）・下（出典・日付）。
 * X は4枚並びのとき各画像を 16:9 に切り抜くため、中央の帯だけはどの表示でも必ず見える。
 */

export const CARD_SIZE = 1080;
const U = CARD_SIZE / 100; // 1cqw

const PAPER = "#fbfbf9";
const SUB = "#4a5058";
const RULE = "#e3e5e2";
const BRAND = "#c9331b";
const DISPLAY = "M PLUS 1";
const BODY = "BIZ UDPGothic";

const px = (cqw: number) => Math.round(cqw * U);

/** カードに載せるサイトのアドレス（X の投稿はリンクを付けると料金が大きく上がるため、画像から辿れるようにする） */
export const CARD_DOMAIN = new URL(siteConfig.url).hostname;

/** ブランドの印（3本線のアイコン）とサイト名・アドレス */
function Brand() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: px(1.4), fontFamily: DISPLAY, fontWeight: 800, fontSize: px(3.2), color: INK }}>
      <div style={{ width: px(4.4), height: px(4.4), borderRadius: px(1.1), background: BRAND, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: px(0.45) }}>
        {[1, 0.85, 0.65].map((o) => (
          <div key={o} style={{ width: px(2.4), height: px(0.5), borderRadius: px(1), background: `rgba(255,255,255,${o})` }} />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
        {siteConfig.name}
        <span style={{ fontSize: px(2.3), fontWeight: 800, color: SUB, letterSpacing: "0.02em" }}>{CARD_DOMAIN}</span>
      </div>
    </div>
  );
}

/** INDEX の回ごとの印（太陽・時計・月）。絵文字は環境で見た目が変わるため図形で描く */
function SlotIcon({ slot, size }: { slot: IndexCard["slot"]; size: number }) {
  const c = INK;
  if (slot === "MORNING") {
    const rays = Array.from({ length: 8 }, (_, i) => i * 45);
    return (
      <svg width={size} height={size} viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="8" fill={c} />
        {rays.map((r) => (
          <rect key={r} x="18.6" y="2" width="2.8" height="7" rx="1.4" fill={c} transform={`rotate(${r} 20 20)`} />
        ))}
      </svg>
    );
  }
  if (slot === "LUNCH") {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="16" fill="none" stroke={c} strokeWidth="3.4" />
        <rect x="18.4" y="9" width="3.2" height="12.5" rx="1.6" fill={c} />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <path d="M26 4a16 16 0 1 0 10 26A13 13 0 0 1 26 4z" fill={c} />
    </svg>
  );
}

/**
 * 共通の枠。左端の色帯と3つの帯（上・下は左右の2要素）。
 * 画像の描画（Satori）では Fragment の子に space-between が効かないため、間を伸びる余白で埋める
 */
function Frame({ color, rows, top, middle, bottom }: { color: string; rows: [number, number, number]; top: [ReactNode, ReactNode]; middle: ReactNode; bottom: [ReactNode, ReactNode] }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: PAPER, color: INK, fontFamily: DISPLAY }}>
      <div style={{ width: px(2.2), height: "100%", background: color, display: "flex" }} />
      <div style={{ width: CARD_SIZE - px(2.2), display: "flex", flexDirection: "column", paddingLeft: px(7.4), paddingRight: px(7.4) }}>
        <div style={{ width: "100%", height: px(rows[0]), display: "flex", alignItems: "flex-end", paddingBottom: px(2.4), color: SUB }}>
          {top[0]}
          <div style={{ flexGrow: 1, display: "flex" }} />
          {top[1]}
        </div>
        <div style={{ width: "100%", height: px(rows[1]), display: "flex", flexDirection: "column", justifyContent: "center" }}>{middle}</div>
        <div style={{ width: "100%", height: px(rows[2]), display: "flex", alignItems: "flex-start", paddingTop: px(3), borderTop: `${px(0.25)}px solid ${RULE}`, color: SUB }}>
          {bottom[0]}
          <div style={{ flexGrow: 1, display: "flex" }} />
          {bottom[1]}
        </div>
      </div>
    </div>
  );
}

function Label({ text, color }: { text: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: px(1.4), fontSize: px(3.4), fontWeight: 800, letterSpacing: "0.08em", color }}>
      <div style={{ width: px(2.2), height: px(2.2), borderRadius: px(0.5), background: color, display: "flex" }} />
      {text}
    </div>
  );
}

function SlotLabel({ title, counter }: { title: string; counter: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: px(1.6), fontSize: px(3.4), fontWeight: 800, letterSpacing: "0.04em" }}>
      {title}
      <span style={{ fontFamily: BODY, fontSize: px(3), fontWeight: 700 }}>{counter}</span>
    </div>
  );
}

function footer(sources: string, stamp: string): [ReactNode, ReactNode] {
  return [
    <div key="s" style={{ display: "flex", fontFamily: BODY, fontSize: px(2.9), fontWeight: 700, lineHeight: 1.5, maxWidth: px(52) }}>
      {sources}
    </div>,
    <div key="b" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: px(1.2) }}>
      <div style={{ display: "flex", fontFamily: BODY, fontSize: px(2.9), fontWeight: 700 }}>{stamp}</div>
      <Brand />
    </div>,
  ];
}

function Headline({ lines }: { lines: string[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", fontWeight: 900, fontSize: px(7), lineHeight: 1.28 }}>
      {lines.map((l, i) => (
        <div key={i} style={{ display: "flex", whiteSpace: "nowrap" }}>
          {l}
        </div>
      ))}
    </div>
  );
}

function NewsCardView({ card }: { card: NewsCard }) {
  return (
    <Frame
      color={card.color}
      rows={[21, 58, 21]}
      top={[
        <SlotLabel key="l" title={card.slotTitle} counter={card.counter} />,
        card.label ? <Label key="r" text={card.label} color={card.color} /> : <div key="r" style={{ display: "flex" }} />,
      ]}
      middle={
        <div style={{ display: "flex", flexDirection: "column", gap: px(4) }}>
          <Headline lines={card.headline} />
          <div style={{ display: "flex", flexDirection: "column", gap: px(2.2), fontFamily: BODY, fontWeight: 700, fontSize: px(4.4), lineHeight: 1.42 }}>
            {card.points.map((p, i) => (
              <div key={i} style={{ display: "flex" }}>
                <div style={{ width: px(5.4), display: "flex", fontFamily: DISPLAY, fontWeight: 900, fontSize: px(4.1), color: card.color }}>{i + 1}</div>
                <div style={{ flex: 1, display: "flex" }}>{p}</div>
              </div>
            ))}
          </div>
          {card.why && (
            <div style={{ display: "flex", gap: px(2), fontFamily: BODY, fontWeight: 700, fontSize: px(3.7), lineHeight: 1.45, color: SUB }}>
              <div style={{ display: "flex", fontFamily: DISPLAY, fontWeight: 800, color: INK, whiteSpace: "nowrap" }}>なぜ重要</div>
              <div style={{ flex: 1, display: "flex" }}>{card.why}</div>
            </div>
          )}
        </div>
      }
      bottom={footer(card.sources, card.stamp)}
    />
  );
}

function FollowupCardView({ card }: { card: FollowupCard }) {
  const row = (label: string, text: string, now: boolean) => (
    <div style={{ display: "flex", alignItems: "flex-start" }}>
      <div style={{ width: px(15), display: "flex", paddingTop: px(0.6), fontFamily: DISPLAY, fontWeight: 800, fontSize: px(2.9), color: now ? FOLLOWUP_COLOR : SUB, whiteSpace: "nowrap" }}>
        {label}
      </div>
      <div style={{ flex: 1, display: "flex", fontFamily: BODY, fontWeight: 700, fontSize: px(4.1), lineHeight: 1.42 }}>{text}</div>
    </div>
  );
  return (
    <Frame
      color={FOLLOWUP_COLOR}
      rows={[21, 58, 21]}
      top={[
        <SlotLabel key="l" title={card.slotTitle} counter={card.counter} />,
        <div
          key="r"
          style={{ display: "flex", fontSize: px(3.4), fontWeight: 900, letterSpacing: "0.1em", color: FOLLOWUP_COLOR, border: `${px(0.35)}px solid ${FOLLOWUP_COLOR}`, borderRadius: px(1), padding: `${px(0.9)}px ${px(2.2)}px` }}
        >
          続報
        </div>,
      ]}
      middle={
        <div style={{ display: "flex", flexDirection: "column", gap: px(4) }}>
          <Headline lines={card.headline} />
          <div style={{ display: "flex", flexDirection: "column", gap: px(1.8) }}>
            {row(card.beforeLabel, card.before, false)}
            {row("現在", card.now, true)}
          </div>
        </div>
      }
      bottom={footer(card.sources, card.stamp)}
    />
  );
}

function BreakingCardView({ card }: { card: BreakingCard }) {
  return (
    <Frame
      color={card.color}
      rows={[21, 58, 21]}
      top={[
        <div key="l" style={{ display: "flex", fontSize: px(3.4), fontWeight: 900, letterSpacing: "0.1em", color: "#ffffff", background: card.color, borderRadius: px(1), padding: `${px(0.9)}px ${px(2.2)}px` }}>
          {card.label}
        </div>,
        <div key="r" style={{ display: "flex", fontFamily: BODY, fontSize: px(3), fontWeight: 700 }}>
          {card.asOf}
        </div>,
      ]}
      middle={
        <div style={{ display: "flex", flexDirection: "column", gap: px(4) }}>
          <Headline lines={card.headline} />
          <div style={{ display: "flex", flexDirection: "column", gap: px(2.2), fontFamily: BODY, fontWeight: 700, fontSize: px(4.4), lineHeight: 1.42 }}>
            {card.points.map((p, i) => (
              <div key={i} style={{ display: "flex" }}>
                <div style={{ width: px(5.4), display: "flex", fontFamily: DISPLAY, fontWeight: 900, fontSize: px(4.1), color: card.color }}>{i + 1}</div>
                <div style={{ flex: 1, display: "flex" }}>{p}</div>
              </div>
            ))}
          </div>
          {card.unknown && (
            <div style={{ display: "flex", flexDirection: "column", fontFamily: BODY, fontWeight: 700, fontSize: px(3.7), lineHeight: 1.45, color: SUB, borderLeft: `${px(0.6)}px solid ${RULE}`, paddingLeft: px(2.4) }}>
              <div style={{ display: "flex", fontFamily: DISPLAY, fontWeight: 800, color: INK }}>まだ分かっていないこと</div>
              <div style={{ display: "flex" }}>{card.unknown}</div>
            </div>
          )}
        </div>
      }
      bottom={footer(card.sources, card.stamp)}
    />
  );
}

function IndexCardView({ card }: { card: IndexCard }) {
  const long = card.title.length > 6;
  const compact = card.entries.length > 5;
  // 要点の1行は3本までのときだけ（4本以上は入りきらない）
  const showDetail = card.entries.length <= 3;
  const main = card.entries.filter((e) => e.role === "MAIN");
  const follow = card.entries.filter((e) => e.role === "FOLLOWUP");
  const fontSize = px(compact ? 3.9 : showDetail ? 4.6 : 4.3);
  const rowGap = px(compact ? 1.1 : showDetail ? 2.2 : 1.5);
  const list = (entries: IndexCard["entries"], offset: number) => (
    <div style={{ display: "flex", flexDirection: "column", gap: rowGap }}>
      {entries.map((e, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "flex-start",
            paddingBottom: i < entries.length - 1 ? rowGap : 0,
            borderBottom: i < entries.length - 1 ? `${px(0.2)}px solid ${RULE}` : "none",
          }}
        >
          <div style={{ width: px(card.timed ? 10 : 5), display: "flex", fontFamily: card.timed ? BODY : DISPLAY, fontWeight: card.timed ? 700 : 900, fontSize: px(card.timed ? 3 : 4.4), lineHeight: 1.35, color: SUB }}>
            {card.timed ? e.time : String(offset + i + 1)}
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: px(0.8) }}>
            <div style={{ display: "flex", alignItems: "center", fontSize, fontWeight: 800, lineHeight: 1.35, whiteSpace: "nowrap" }}>
              <div style={{ width: px(15), display: "flex", alignItems: "center", gap: px(0.8), fontSize: px(2.8), fontWeight: 800, color: e.color }}>
                <div style={{ width: px(1.6), height: px(1.6), background: e.color, display: "flex" }} />
                {e.label}
              </div>
              <div style={{ display: "flex", color: e.role === "FOLLOWUP" ? FOLLOWUP_COLOR : INK }}>{e.text}</div>
            </div>
            {e.detail && showDetail && (
              <div style={{ display: "flex", paddingLeft: px(15), fontFamily: BODY, fontSize: px(3.5), fontWeight: 700, lineHeight: 1.4, color: SUB }}>{e.detail}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
  return (
    <Frame
      color={INK}
      rows={[15, 69, 16]}
      top={[
        <div key="l" style={{ display: "flex", fontSize: px(3.4), fontWeight: 800, letterSpacing: "0.04em" }}>
          {card.dateLabel}
        </div>,
        <div key="r" style={{ display: "flex", fontFamily: BODY, fontSize: px(3.4), fontWeight: 700 }}>
          {card.time}
        </div>,
      ]}
      middle={
        <div style={{ display: "flex", flexDirection: "column", gap: px(3) }}>
          <div style={{ display: "flex", alignItems: "center", gap: px(2.2), whiteSpace: "nowrap" }}>
            <SlotIcon slot={card.slot} size={px(long ? 6 : 7)} />
            <div style={{ display: "flex", fontSize: px(long ? 6.6 : 8), fontWeight: 900, lineHeight: 1.1 }}>{card.title}</div>
            <div style={{ display: "flex", fontSize: px(3.6), fontWeight: 800, color: SUB, paddingTop: px(1.6) }}>{`${card.mainCount}本`}</div>
          </div>
          {list(main, 0)}
          {follow.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: px(1.4) }}>
              <div style={{ display: "flex", alignItems: "center", gap: px(1.6), fontSize: px(3.1), fontWeight: 800, color: FOLLOWUP_COLOR, letterSpacing: "0.06em" }}>
                結局どうなった
                <div style={{ flex: 1, height: px(0.2), background: "#b9c0dd", display: "flex" }} />
              </div>
              {list(follow, main.length)}
            </div>
          )}
        </div>
      }
      bottom={[
        <div key="l" style={{ display: "flex", fontFamily: BODY, fontSize: px(2.9), fontWeight: 700 }}>
          左右にスワイプで詳しく
        </div>,
        <Brand key="r" />,
      ]}
    />
  );
}

function cardText(card: Card): string {
  const base = `${siteConfig.name}${CARD_DOMAIN}出典：速報まだ分かっていないこと続報結局どうなった現在前回朝昼昨夜の時点なぜ重要左右にスワイプで詳しく本0123456789/:・（）ほか`;
  return base + JSON.stringify(card);
}

/** 文字だけを取り寄せたフォント（同じ文字の組み合わせは使い回す） */
const fontCache = new Map<string, Promise<ArrayBuffer | null>>();
function font(family: string, weight: number, text: string) {
  const chars = [...new Set(text)].sort().join("");
  const key = `${family}:${weight}:${chars}`;
  let p = fontCache.get(key);
  if (!p) {
    p = loadGoogleFont(family, weight, chars);
    fontCache.set(key, p);
    if (fontCache.size > 200) fontCache.delete(fontCache.keys().next().value!);
    void p.then((v) => v === null && fontCache.delete(key));
  }
  return p;
}

export async function renderCard(card: Card) {
  const started = Date.now();
  const text = cardText(card);
  const [d800, d900, body] = await Promise.all([font(DISPLAY, 800, text), font(DISPLAY, 900, text), font(BODY, 700, text)]);
  const fonts = [
    d800 && { name: DISPLAY, data: d800, weight: 800 as const, style: "normal" as const },
    d900 && { name: DISPLAY, data: d900, weight: 900 as const, style: "normal" as const },
    body && { name: BODY, data: body, weight: 700 as const, style: "normal" as const },
  ].filter((f) => !!f);
  if (fonts.length < 3) throw new Error("カード用のフォントを取得できませんでした");
  console.log(JSON.stringify({ event: "card", level: "info", type: card.type, message: "fonts ready", ms: Date.now() - started }));
  const view =
    card.type === "INDEX" ? (
      <IndexCardView card={card} />
    ) : card.type === "FOLLOWUP" ? (
      <FollowupCardView card={card} />
    ) : card.type === "BREAKING" ? (
      <BreakingCardView card={card} />
    ) : (
      <NewsCardView card={card} />
    );
  return new ImageResponse(view, { width: CARD_SIZE, height: CARD_SIZE, fonts });
}

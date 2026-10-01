/** 企業の業績・資本に関わる出来事の種類（投資家が見分けやすいよう話題に目印を付ける） */
export const MARKET_EVENTS = {
  earnings: { label: "決算", evidence: /決算|四半期|通期|純利益|純損益|営業利益|営業損益|経常利益|売上高|増益|減益|黒字|赤字/ },
  forecast: { label: "業績予想", evidence: /業績予想|見通し|上方修正|下方修正|予想を(引き上げ|引き下げ)/ },
  deal: { label: "M&A・提携", evidence: /買収|合併|経営統合|TOB|株式公開買い付け|資本提携|出資|子会社化|事業譲渡|売却/ },
  shareholder: { label: "株主還元", evidence: /配当|自社株買い|株主還元|株式分割/ },
  listing: { label: "上場", evidence: /上場|IPO|上場廃止/ },
} as const;

export type MarketEvent = keyof typeof MARKET_EVENTS;
export const MARKET_EVENT_KEYS = Object.keys(MARKET_EVENTS) as [MarketEvent, ...MarketEvent[]];

/** 資料に裏付けとなる言葉がある場合だけ目印を認める（AI の判定をそのまま信じない） */
export function verifyMarketEvent(event: MarketEvent | null | undefined, sourceText: string): MarketEvent | null {
  if (!event || !(event in MARKET_EVENTS)) return null;
  return MARKET_EVENTS[event].evidence.test(sourceText.normalize("NFKC")) ? event : null;
}

export function marketEventLabel(event: string | null | undefined): string | null {
  return event && event in MARKET_EVENTS ? MARKET_EVENTS[event as MarketEvent].label : null;
}

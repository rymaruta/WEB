import { XMLParser } from "fast-xml-parser";
import { decodeEntities, normalizeUrl, toPlainText, toSummary } from "./text";

export type ParsedItem = {
  url: string;
  rawTitle: string;
  summary: string | null;
  imageUrl: string | null;
  publishedAt: Date | null;
  /** はてなブックマーク数など。フィードが提供しない場合は 0 */
  socialCount: number;
};

export type ParsedFeed = {
  format: "rss" | "rdf" | "atom";
  title: string;
  items: ParsedItem[];
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // 実体参照は text.ts で一度だけ展開する（二重展開や XML/HTML の混在を避けるため）
  processEntities: false,
  parseTagValue: false,
  trimValues: true,
  cdataPropName: false,
  isArray: (name) => ["item", "entry", "link", "media:content", "media:thumbnail", "enclosure"].includes(name),
});

type Node = Record<string, unknown>;

function text(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return text(value[0]);
  if (typeof value === "object") return text((value as Node)["#text"]);
  return "";
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function parseDate(...candidates: unknown[]): Date | null {
  for (const c of candidates) {
    const s = text(c).trim();
    if (!s) continue;
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function firstImage(item: Node, base: string): string | null {
  const candidates: unknown[] = [];
  for (const key of ["media:thumbnail", "media:content"]) {
    for (const m of asArray(item[key] as Node | Node[])) {
      candidates.push(m?.["@_url"]);
    }
  }
  for (const e of asArray(item["enclosure"] as Node | Node[])) {
    const type = text(e?.["@_type"]);
    if (!type || type.startsWith("image/")) candidates.push(e?.["@_url"]);
  }
  candidates.push(item["hatena:imageurl"]);
  for (const c of candidates) {
    const url = normalizeUrl(decodeEntities(text(c)), base);
    if (url) return url;
  }
  return null;
}

function atomLink(entry: Node): string {
  const links = asArray(entry["link"] as Node | Node[] | string);
  for (const l of links) {
    if (typeof l === "string") return l;
    const rel = text(l?.["@_rel"]) || "alternate";
    if (rel === "alternate" && l?.["@_href"]) return text(l["@_href"]);
  }
  const first = links[0];
  return typeof first === "string" ? first : text(first?.["@_href"]);
}

function toItem(
  fields: { link: string; title: unknown; description: unknown; date: Date | null; node: Node },
  base: string,
): ParsedItem | null {
  const url = normalizeUrl(decodeEntities(fields.link), base);
  const rawTitle = text(fields.title);
  if (!url || !toPlainText(rawTitle)) return null;
  const social = parseInt(text(fields.node["hatena:bookmarkcount"]), 10);
  return {
    url,
    rawTitle,
    summary: toSummary(text(fields.description)),
    imageUrl: firstImage(fields.node, url),
    publishedAt: fields.date,
    socialCount: Number.isFinite(social) ? social : 0,
  };
}

export function parseFeed(xml: string, feedUrl: string): ParsedFeed {
  const doc = parser.parse(xml) as Node;

  const rss = doc["rss"] as Node | undefined;
  if (rss) {
    const channel = (rss["channel"] ?? {}) as Node;
    const items = asArray(channel["item"] as Node[]).flatMap((it) => {
      const item = toItem(
        {
          link: text(it["link"]) || text(it["guid"]),
          title: it["title"],
          description: it["description"] ?? it["content:encoded"],
          date: parseDate(it["pubDate"], it["dc:date"], it["published"]),
          node: it,
        },
        feedUrl,
      );
      return item ? [item] : [];
    });
    return { format: "rss", title: toPlainText(text(channel["title"])), items };
  }

  const rdf = doc["rdf:RDF"] as Node | undefined;
  if (rdf) {
    const channel = (rdf["channel"] ?? {}) as Node;
    const items = asArray(rdf["item"] as Node[]).flatMap((it) => {
      const item = toItem(
        {
          link: text(it["link"]) || text(it["@_rdf:about"]),
          title: it["title"],
          description: it["description"] ?? it["content:encoded"],
          date: parseDate(it["dc:date"], it["pubDate"]),
          node: it,
        },
        feedUrl,
      );
      return item ? [item] : [];
    });
    return { format: "rdf", title: toPlainText(text(channel["title"])), items };
  }

  const feed = doc["feed"] as Node | undefined;
  if (feed) {
    const items = asArray(feed["entry"] as Node[]).flatMap((it) => {
      const item = toItem(
        {
          link: atomLink(it),
          title: it["title"],
          description: it["summary"] ?? it["content"],
          date: parseDate(it["published"], it["updated"], it["dc:date"]),
          node: it,
        },
        feedUrl,
      );
      return item ? [item] : [];
    });
    return { format: "atom", title: toPlainText(text(feed["title"])), items };
  }

  throw new Error("RSS / RDF / Atom のいずれでもない形式です");
}

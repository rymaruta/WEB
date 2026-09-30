import { describe, expect, it } from "vitest";
import { parseFeed } from "@/lib/feed/parse";
import { cleanTitle, normalizeUrl, splitSiteSuffix, toPlainText, toSummary } from "@/lib/feed/text";

const RSS2 = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
<channel><title>テスト &amp; ニュース</title>
<item>
  <title><![CDATA[大谷が50号 &amp; 50盗塁 - テスト新聞]]></title>
  <link>https://example.com/a/1?utm_source=rss&amp;id=1#top</link>
  <description><![CDATA[<p>ざっくり言うと<br/>本文の<b>要約</b>です。</p><a href="#">記事を読む</a>]]></description>
  <pubDate>Wed, 30 Sep 2026 21:00:00 +0900</pubDate>
  <enclosure url="https://example.com/a.jpg" type="image/jpeg"/>
</item>
<item><title>リンクなし</title></item>
</channel></rss>`;

const RDF = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/"
  xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:hatena="http://www.hatena.ne.jp/info/xmlns#">
<channel rdf:about="https://b.example/"><title>&#x306F;&#x3066;&#x306A;</title></channel>
<item rdf:about="https://news.example/x">
  <title>&#x65B0;&#x6A5F;&#x80FD;</title>
  <link>https://news.example/x</link>
  <description>[画像1: https://img.example/1.png] 説明文</description>
  <dc:date>2026-09-30T06:22:41Z</dc:date>
  <hatena:bookmarkcount>255</hatena:bookmarkcount>
</item>
</rdf:RDF>`;

const ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>野球</title>
<entry>
  <title>【阪神】勝利</title>
  <link rel="self" href="https://example.com/self"/>
  <link rel="alternate" type="text/html" href="https://example.com/baseball/1.html"/>
  <published>2026-09-30T21:19:38+09:00</published>
  <summary>試合終了後、花束が贈呈された。</summary>
</entry></feed>`;

describe("parseFeed", () => {
  it("RSS 2.0 を解析し、要約から定型文を除き、追跡パラメータを除去する", () => {
    const feed = parseFeed(RSS2, "https://example.com/rss");
    expect(feed.format).toBe("rss");
    expect(feed.title).toBe("テスト & ニュース");
    expect(feed.items).toHaveLength(1);
    const [item] = feed.items;
    expect(item.url).toBe("https://example.com/a/1?id=1");
    expect(cleanTitle(item.rawTitle, ["テスト新聞"])).toBe("大谷が50号 & 50盗塁");
    expect(item.summary).toBe("本文の 要約 です。");
    expect(item.imageUrl).toBe("https://example.com/a.jpg");
    expect(item.publishedAt?.toISOString()).toBe("2026-09-30T12:00:00.000Z");
  });

  it("RDF（RSS 1.0）の数値文字参照とはてなブックマーク数を扱う", () => {
    const feed = parseFeed(RDF, "https://b.example/rss");
    expect(feed.format).toBe("rdf");
    expect(feed.title).toBe("はてな");
    const [item] = feed.items;
    expect(toPlainText(item.rawTitle)).toBe("新機能");
    expect(item.socialCount).toBe(255);
    expect(item.summary).toBe("説明文");
    expect(item.imageUrl).toBeNull();
  });

  it("Atom の alternate リンクを記事 URL に使う", () => {
    const feed = parseFeed(ATOM, "https://example.com/atom.xml");
    expect(feed.format).toBe("atom");
    expect(feed.items[0].url).toBe("https://example.com/baseball/1.html");
    expect(feed.items[0].publishedAt?.toISOString()).toBe("2026-09-30T12:19:38.000Z");
  });

  it("未知の形式はエラーにする", () => {
    expect(() => parseFeed("<html></html>", "https://example.com")).toThrow();
  });
});

describe("text helpers", () => {
  it("normalizeUrl は空文字や非 HTTP を拒否する", () => {
    expect(normalizeUrl("", "https://example.com")).toBeNull();
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("/path", "https://Example.com/feed")).toBe("https://example.com/path");
  });

  it("toSummary は指定文字数で切り詰める", () => {
    expect(toSummary("あ".repeat(130))).toBe("あ".repeat(120) + "…");
    expect(toSummary("   ")).toBeNull();
  });

  it("cleanTitle は媒体名と一致しない末尾を残す", () => {
    expect(cleanTitle("日本代表 - エクアドル戦へ", ["テスト新聞"])).toBe("日本代表 - エクアドル戦へ");
  });
});

describe("title cleanup", () => {
  it("先頭の配信元表記と末尾の定型語を除く", () => {
    expect(cleanTitle("[ITmedia News] 新機能を発表")).toBe("新機能を発表");
    expect(cleanTitle("望月ヘンリー海輝が合流 | 記事")).toBe("望月ヘンリー海輝が合流");
  });

  it("splitSiteSuffix は空白で区切られた末尾のサイト名だけを分離する", () => {
    expect(splitSiteSuffix("声にもパブリシティー権、初の司法判断 - 日本経済新聞")).toEqual({
      title: "声にもパブリシティー権、初の司法判断",
      site: "日本経済新聞",
    });
    expect(splitSiteSuffix("GPT-6.1 Solが登場")).toEqual({ title: "GPT-6.1 Solが登場", site: null });
  });
});

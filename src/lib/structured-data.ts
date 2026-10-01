import { siteConfig } from "@/config/site";
import type { AiArticle } from "@/lib/ai/article";

/**
 * 検索エンジン向けの構造化データ（JSON-LD）。Google ニュースや Discover で記事として扱われやすくする。
 * 独自の文章である AI まとめ記事のページにだけ付ける
 */

const publisher = () => ({
  "@type": "Organization",
  name: siteConfig.name,
  url: siteConfig.url,
  logo: { "@type": "ImageObject", url: `${siteConfig.url}/apple-icon.png` },
});

export function newsArticleJsonLd(topicId: number, article: AiArticle, sources: { url: string; publisher: string }[]) {
  const url = `${siteConfig.url}/topic/${topicId}`;
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    headline: article.title,
    description: article.lead || undefined,
    image: [`${url}/opengraph-image`],
    datePublished: article.generatedAt.toISOString(),
    dateModified: article.generatedAt.toISOString(),
    inLanguage: "ja",
    author: { "@type": "Organization", name: siteConfig.name, url: siteConfig.url },
    publisher: publisher(),
    // まとめの材料にした各媒体の記事
    isBasedOn: sources.map((s) => ({ "@type": "NewsArticle", url: s.url, publisher: { "@type": "Organization", name: s.publisher } })),
  };
}

/** <script type="application/ld+json"> に埋め込める文字列。</script> などで HTML が壊れないよう < を逃がす */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

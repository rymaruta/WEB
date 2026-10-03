import { siteConfig } from "@/config/site";

/**
 * Google AdSense（自動広告）のコード。独自の内容があるページだけに置く（各ページの組の layout.tsx と、トップ・ジャンルのページ）。
 * 検索結果・保存・フォロー・他サイトの動画・規約やお問い合わせなど、独自の内容が少ないページには置かない
 * （AdSense のポリシー：コンテンツのない画面や価値の低い画面に広告を出さない）。
 * React が <head> に移して読み込むので、ページの表示は待たせない
 */
export function AdsenseScript() {
  if (!siteConfig.adsenseClient) return null;
  return <script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${siteConfig.adsenseClient}`} crossOrigin="anonymous" />;
}

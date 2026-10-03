import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "運営方針・お問い合わせ",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-6 card p-5 text-[15px] leading-relaxed sm:p-8">
      <h1 className="text-2xl font-extrabold">運営方針・お問い合わせ</h1>

      <section>
        <h2 className="mb-2 text-lg font-bold">{siteConfig.name}について</h2>
        <p>
          {siteConfig.name}は、国内・国際・経済・IT・エンタメ・スポーツ・新商品まで、ジャンルを問わず主要メディアのニュースを一か所で確認できる総合ポータルです。
          同じ出来事を報じた複数の記事を自動で「トピック」にまとめ、各媒体の報道を読み比べられるようにしています。
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">掲載方針</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>各媒体が公開している RSS 等の配信情報を取得し、見出し・短い要約（最大120文字）・元記事へのリンクのみを掲載します。記事本文は転載しません。</li>
          <li>サムネイル画像は、各媒体の配信情報に含まれる画像を、表示を軽くするため当サイトのサーバーで縮小して表示しています。縮小した画像は表示のために一時的（最長1日）に保存するだけで、それ以外の目的には使いません。</li>
          <li>記事を読む際は、必ず各媒体のサイトへ移動します。</li>
          <li>収集は一定間隔で行い、各サイトに過度な負荷をかけないよう、同一サイトへの連続アクセスを制限しています。自動取得を拒否しているサイトからは収集しません。</li>
          <li>話題の順位は、報じた媒体数・SNS での反応・当サイトでの閲覧数と新しさから機械的に算出しており、編集部による恣意的な操作は行っていません。企業のプレスリリースは媒体数に数えず、同じ告知が一斉に載りやすいジャンル（ゲーム・アニメ、新商品など）は控えめに扱っています。</li>
          <li>掲載しているメディアは<Link href="/sources" className="text-accent underline">掲載メディア一覧</Link>で公開しています。</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">AIまとめ記事について</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>複数の媒体が報じた話題について、各媒体が配信した見出しと要約だけを材料に、AI（Anthropic 社の Claude）がまとめ記事を自動で作成しています。</li>
          <li>材料にない情報の追加や推測は行わないよう指示し、各要点には根拠となった記事への出典番号を付けています。</li>
          <li>AI が作成した記事には、その旨と作成日時を明記しています。誤りを含む可能性があるため、正確な内容は各媒体の記事でご確認ください。</li>
          <li>誤りを見つけた場合は、下記のお問い合わせ先までお知らせください。</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">訂正と更新の方針</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>新しい報道が加わると、まとめ記事を書き直します。書き直した記事には「更新」と日時を表示し、黙って書き換えることはしません。</li>
          <li>誤りのご指摘を受けた場合は、元の報道と照らし合わせて確認し、誤りであれば速やかに訂正します。各記事の「誤りを報告」からお知らせください。</li>
          <li>見出しの数字が媒体によって異なる場合は、どの媒体がどの数字を報じたかを並べて表示し、どちらかに決めつけません。</li>
          <li>まとめ記事のうち、3つ以上の媒体の報道を突き合わせたもの、各社の報じ方の違いや経緯を示したものだけを検索エンジンに登録しています。</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">X（旧 Twitter）での定時配信について</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>毎日 7:00・12:00・20:00 に、その時点で大事なニュースを最大3本選んで配信しています。</li>
          <li>選ぶのは、複数の媒体が報じ、AI の要約が出典と照らし合わせる自動の確認を通った出来事だけです。事件・事故で個人が特定されうるものなど、確認が必要な内容は自動では配信しません。</li>
          <li>政治・経済・国際のニュースを1本以上入れ、同じジャンルに偏らないようにしています。</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">メディア関係者の方へ</h2>
        <p>
          掲載の停止、表示内容の修正、提携のご相談は、下記の窓口までご連絡ください。確認のうえ速やかに対応いたします。
          当サイトのクローラーは <code className="rounded bg-surface-muted px-1 text-sm">{siteConfig.crawlerUserAgent}</code> を名乗ります。
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">個人情報・広告・アクセス解析</h2>
        <p>
          取り扱いの詳細は<Link href="/privacy" className="text-accent underline">プライバシーポリシー</Link>をご覧ください。
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">アクセス解析について</h2>
        <p>
          サイト改善のため、Amazon CloudWatch RUM でページの閲覧数や閲覧環境（ブラウザー・端末の種類など）を集計しています。この解析では Cookie を使用せず、個人を特定できる情報は収集しません。
          あわせて Google アナリティクスで閲覧数や参照元を集計しています（Cookie を使用します。詳しくはプライバシーポリシーをご覧ください）。
          また、記事の閲覧数ランキングのため、元記事へのリンクが開かれた回数を記録しています。
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">免責事項</h2>
        <p>
          掲載情報は各媒体の配信内容に基づくもので、その正確性・完全性を当サイトが保証するものではありません。
          記事の内容に関するお問い合わせは、各媒体へお願いいたします。
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">運営者</h2>
        <p>{siteConfig.name}</p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">お問い合わせ</h2>
        <p>
          <a href={`mailto:${siteConfig.contactEmail}`} className="text-accent underline">{siteConfig.contactEmail}</a>
        </p>
      </section>
    </article>
  );
}

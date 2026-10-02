import type { Metadata } from "next";
import { CalendarView } from "@/components/calendar-view";
import { CALENDAR_CATEGORIES, CALENDAR_LABELS, getCalendar } from "@/lib/calendar";
import { breadcrumbJsonLd, serializeJsonLd } from "@/lib/structured-data";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "ぜんぶカレンダー｜ゲーム・アニメ・映画・新商品・値上げの予定が1つに",
  description:
    "ゲームの発売日、アニメの放送開始、映画の公開日、新商品の発売日、値上げや制度の変更を、1つのカレンダーにまとめました。分野で絞り込めて、スマホのカレンダーにも追加できます。",
  alternates: { canonical: "/calendar" },
};

export default async function CalendarPage() {
  const { from, to, items } = await getCalendar();
  const counts = Object.fromEntries(CALENDAR_CATEGORIES.map((c) => [c, items.filter((it) => it.category === c).length]));
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            breadcrumbJsonLd([
              { name: "トップ", path: "/" },
              { name: "ぜんぶカレンダー", path: "/calendar" },
            ]),
          ),
        }}
      />
      <header className="card p-5 sm:p-6">
        <h1 className="text-2xl font-black">ぜんぶカレンダー</h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          これから始まるものを、分野をまたいで1つのカレンダーにまとめました。今日から{Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1}
          日間で全{items.length}件（{CALENDAR_CATEGORIES.filter((c) => counts[c] > 0)
            .map((c) => `${CALENDAR_LABELS[c]} ${counts[c]}件`)
            .join("、")}
          ）。
        </p>
      </header>
      <CalendarView items={items} counts={counts} />
      <p className="text-xs leading-relaxed text-fg-subtle">
        日付は、ニュースで報じられた内容・任天堂/PlayStation/Steam の公式ストア・Wikipedia（映画・テレビアニメの一覧、CC BY-SA）をもとに自動でまとめています。
        予定は変わることがあるため、最新の情報は各社の発表でご確認ください。
      </p>
    </div>
  );
}

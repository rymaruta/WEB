import { redirect } from "next/navigation";
import { weekKey } from "@/lib/weekly";

export const dynamic = "force-dynamic";

/**
 * 今週の10大ニュースへ。ページ（page.tsx）で redirect すると、読み込み中の表示を先に返すため
 * 200 のページになってしまう（検索エンジンには中身のないページに見える）。ルートで HTTP の転送にする
 */
export function GET() {
  redirect(`/weekly/${weekKey()}`);
}

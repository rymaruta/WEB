import { redirect } from "next/navigation";
import { archiveMonths } from "@/lib/archive";

export const dynamic = "force-dynamic";

/** 月間まとめの入口は、今月のページへ（HTTP の転送。理由は weekly/route.ts と同じ） */
export function GET() {
  redirect(`/archive/${archiveMonths()[0]}`);
}

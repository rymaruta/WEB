import { redirect } from "next/navigation";
import { archiveMonths } from "@/lib/archive";

/** 月間まとめの入口は、今月のページへ */
export default function ArchiveIndex() {
  redirect(`/archive/${archiveMonths()[0]}`);
}

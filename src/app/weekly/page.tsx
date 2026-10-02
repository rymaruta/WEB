import { redirect } from "next/navigation";
import { weekKey } from "@/lib/weekly";

export const dynamic = "force-dynamic";

/** 今週の10大ニュースへ */
export default function WeeklyIndex() {
  redirect(`/weekly/${weekKey()}`);
}

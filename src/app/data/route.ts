import { redirect } from "next/navigation";
import { weekKey } from "@/lib/weekly";

export const dynamic = "force-dynamic";

/** 今週の報道データへ（HTTP の転送。src/app/weekly/route.ts と同じ理由） */
export function GET() {
  redirect(`/data/${weekKey()}`);
}

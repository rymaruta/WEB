import type { Metadata } from "next";
import { WorkPage, workMetadata } from "@/components/work-page";

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<"/game/[key]">): Promise<Metadata> {
  return workMetadata("game", (await params).key);
}

export default async function Page({ params }: PageProps<"/game/[key]">) {
  return <WorkPage kind="game" raw={(await params).key} />;
}

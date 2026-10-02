import type { Metadata } from "next";
import { WorkPage, workMetadata } from "@/components/work-page";

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<"/anime/[key]">): Promise<Metadata> {
  return workMetadata("anime", (await params).key);
}

export default async function Page({ params }: PageProps<"/anime/[key]">) {
  return <WorkPage kind="anime" raw={(await params).key} />;
}

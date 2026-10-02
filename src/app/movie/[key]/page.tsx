import type { Metadata } from "next";
import { WorkPage, workMetadata } from "@/components/work-page";

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<"/movie/[key]">): Promise<Metadata> {
  return workMetadata("movie", (await params).key);
}

export default async function Page({ params }: PageProps<"/movie/[key]">) {
  return <WorkPage kind="movie" raw={(await params).key} />;
}

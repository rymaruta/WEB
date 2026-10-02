import type { Metadata } from "next";
import { parsePage } from "@/components/pagination";
import { TagTopics, tagMetadata } from "@/components/tag-topics";

export const revalidate = 600;

export async function generateMetadata({ params }: PageProps<"/team/[slug]">): Promise<Metadata> {
  return tagMetadata("team", (await params).slug);
}

export default async function Page({ params, searchParams }: PageProps<"/team/[slug]">) {
  return <TagTopics kind="team" slug={(await params).slug} page={parsePage((await searchParams).page)} />;
}

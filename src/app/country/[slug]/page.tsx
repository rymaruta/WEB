import type { Metadata } from "next";
import { parsePage } from "@/components/pagination";
import { TagTopics, tagMetadata } from "@/components/tag-topics";

export const revalidate = 600;

export async function generateMetadata({ params }: PageProps<"/country/[slug]">): Promise<Metadata> {
  return tagMetadata("country", (await params).slug);
}

export default async function Page({ params, searchParams }: PageProps<"/country/[slug]">) {
  return <TagTopics kind="country" slug={(await params).slug} page={parsePage((await searchParams).page)} />;
}

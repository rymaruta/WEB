import { AdsenseScript } from "@/components/adsense-script";

/** 独自の内容があるページなので広告を出す（src/components/adsense-script.tsx） */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdsenseScript />
      {children}
    </>
  );
}

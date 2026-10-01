"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * 閲覧を数えるための小さな通知。ページが表示されたときに、パスと参照元だけを送る。
 * 流入元はサイトに入った最初のページの参照元で決まり、サイト内の移動は流入として数えない
 */
export function PageviewBeacon() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (!pathname || navigator.webdriver) return;
    const ref = first.current ? document.referrer : window.location.origin;
    first.current = false;
    const data = JSON.stringify({ path: pathname, ref });
    try {
      if (!navigator.sendBeacon?.("/api/pv", new Blob([data], { type: "application/json" }))) {
        void fetch("/api/pv", { method: "POST", body: data, headers: { "content-type": "application/json" }, keepalive: true });
      }
    } catch {
      // 数えられなくても表示には影響させない
    }
  }, [pathname]);
  return null;
}

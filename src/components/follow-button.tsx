"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { followingHref, MAX_FOLLOWS, type Follow } from "@/lib/follow-kinds";
import { getFollows, getFollowsOnServer, subscribeFollows, toggleFollow } from "@/lib/follows";

/** 会社・チーム・国・キーワードをフォローするボタン。フォローはこの端末だけに保存（ログイン不要） */
export function FollowButton({ follow }: { follow: Follow }) {
  const list = useSyncExternalStore(subscribeFollows, getFollows, getFollowsOnServer);
  const on = list.some((f) => f.kind === follow.kind && f.key === follow.key);
  const [failed, setFailed] = useState(false);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-pressed={on}
        onClick={() => setFailed(!toggleFollow(follow))}
        className={`inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-bold transition-colors ${
          on ? "border-accent bg-accent text-accent-fg" : "border-accent text-accent hover:bg-accent-soft"
        }`}
      >
        {on ? "✓ フォロー中" : "＋ フォロー"}
      </button>
      {on && (
        <Link href={followingHref(list)} prefetch={false} className="text-xs text-accent hover:underline">
          フォロー中のニュースを見る
        </Link>
      )}
      {failed && <span className="text-xs text-fg-subtle">フォローできるのは{MAX_FOLLOWS}件までです（この端末に保存できない場合もあります）</span>}
    </span>
  );
}

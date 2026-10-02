"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { FOLLOW_KIND_LABELS, FOLLOW_KINDS, followingHref, followParam, MAX_FOLLOWS } from "@/lib/follow-kinds";
import { getFollows, getFollowsOnServer, removeFollow, subscribeFollows, toggleFollow } from "@/lib/follows";

/**
 * フォローの一覧（この端末に保存）を、ページのアドレスにそろえる。
 * サーバーはアドレスに入ったフォローをもとにニュースを集めるため、フォローを変えたらアドレスを変えて読み直す
 */
export function FollowingSync() {
  const follows = useSyncExternalStore(subscribeFollows, getFollows, getFollowsOnServer);
  const params = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const current = params.getAll("f").join("|");
    const wanted = follows.map(followParam).join("|");
    // この端末にフォローがない（共有されたアドレスを開いたなど）ときは、アドレスのまま表示する
    if (follows.length > 0 && current !== wanted) router.replace(followingHref(follows), { scroll: false });
  }, [follows, params, router]);
  return null;
}

/** フォロー中の一覧と、キーワードの追加 */
export function FollowManager() {
  const follows = useSyncExternalStore(subscribeFollows, getFollows, getFollowsOnServer);
  const [word, setWord] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <div className="space-y-3">
      {/* 企業・チーム・国・キーワードを混ぜずに、種類ごとに分けて出す */}
      {FOLLOW_KINDS.map((kind) => {
        const list = follows.filter((f) => f.kind === kind);
        if (list.length === 0) return null;
        return (
          <div key={kind}>
            <h2 className="mb-1.5 text-xs font-bold text-fg-muted">{FOLLOW_KIND_LABELS[kind]}</h2>
            <ul className="flex flex-wrap gap-2">
              {list.map((f) => (
                <li key={followParam(f)} className="inline-flex items-center gap-1 rounded-full border border-accent bg-accent-soft py-0.5 pr-1 pl-3 text-xs font-bold text-accent">
                  {f.label}
                  <button type="button" aria-label={`${f.label}のフォローをやめる`} onClick={() => removeFollow(f.kind, f.key)} className="rounded-full px-1.5 text-fg-subtle hover:text-accent">
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const w = word.trim();
          if (!w) return;
          if (!toggleFollow({ kind: "word", key: w, label: w })) setMsg(`フォローできるのは${MAX_FOLLOWS}件までです`);
          else {
            setWord("");
            setMsg("");
          }
        }}
      >
        <input
          value={word}
          onChange={(e) => setWord(e.target.value)}
          maxLength={40}
          placeholder="キーワードでフォロー（例：薬屋のひとりごと、iPhone）"
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-base"
        />
        <button type="submit" className="shrink-0 rounded-lg border border-accent bg-accent px-3 text-sm font-bold text-accent-fg">
          追加
        </button>
      </form>
      {msg && <p className="text-xs text-accent">{msg}</p>}
    </div>
  );
}

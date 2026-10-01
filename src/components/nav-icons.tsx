import type { ReactNode } from "react";

export type NavIconName = "home" | "ranking" | "articles" | "search";

/** メニュー用の線画アイコン（24x24, stroke） */
const PATHS: Record<NavIconName, ReactNode> = {
  home: (
    <>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h5v-6h4v6h5V10" />
    </>
  ),
  ranking: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
      <path d="M8 6H5a3 3 0 0 0 3 4" />
      <path d="M16 6h3a3 3 0 0 1-3 4" />
      <path d="M12 13v4" />
      <path d="M8 20h8" />
      <path d="M9 20l1-3h4l1 3" />
    </>
  ),
  articles: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8" />
      <path d="M8 12h8" />
      <path d="M8 16h5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
};

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}

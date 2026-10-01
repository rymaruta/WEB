type Props = { rank: number; size?: "sm" | "md" };

const MEDALS: Record<number, string> = { 1: "rank-gold", 2: "rank-silver", 3: "rank-bronze" };

/** 順位の表示。1〜3位は金・銀・銅のメダル、4位以下は数字のみ */
export function RankBadge({ rank, size = "sm" }: Props) {
  const box = size === "md" ? "h-7 w-7 text-sm" : "h-6 w-6 text-xs";
  const medal = MEDALS[rank];
  return (
    <span
      aria-label={`${rank}位`}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-black tabular-nums ${box} ${
        medal ? `rank-medal ${medal}` : "text-fg-subtle"
      }`}
    >
      {rank}
    </span>
  );
}

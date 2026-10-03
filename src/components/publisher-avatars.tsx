type Props = { names: string[]; max?: number; size?: "sm" | "md" };

/**
 * 報じた媒体を、媒体名の文字で示す（「共同通信・NHK・朝日新聞 ほか2社」）。
 * 以前は頭文字の丸アイコンだったが、頭文字だけでは何の媒体か分からないため名前で出す（レビュー TOP10-7）
 */
export function PublisherAvatars({ names, max = 5, size = "sm" }: Props) {
  const shown = names.slice(0, Math.min(max, 3));
  const rest = names.length - shown.length;
  return (
    <span className={`min-w-0 truncate text-fg-muted ${size === "md" ? "text-sm" : "text-xs"}`} title={names.join("、")}>
      <span className="sr-only">報じた媒体: </span>
      {shown.join("・")}
      {rest > 0 && <span className="ml-1 whitespace-nowrap">ほか{rest}社</span>}
    </span>
  );
}

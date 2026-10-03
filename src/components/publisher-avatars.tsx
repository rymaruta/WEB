/** 媒体名から安定した色相を決める */
function hue(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) % 360;
  return h;
}

/** 媒体名の頭文字（英字は大文字1字、それ以外は先頭1字） */
function initial(name: string): string {
  const first = Array.from(name.replace(/^(www\.|the\s+)/i, ""))[0] ?? "?";
  return first.toUpperCase();
}

type Props = { names: string[]; max?: number; size?: "sm" | "md" };

/** 報じた媒体を頭文字の丸アイコンで重ねて表示する */
export function PublisherAvatars({ names, max = 5, size = "sm" }: Props) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  const dim = size === "md" ? "h-8 w-8 text-sm" : "h-6 w-6 text-[11px]";
  return (
    <span className="flex items-center" role="img" aria-label={`報じた媒体: ${names.join("、")}`}>
      {shown.map((n, i) => (
        <span
          key={n}
          title={n}
          aria-hidden
          className={`${dim} ${i > 0 ? "-ml-1.5" : ""} inline-flex items-center justify-center rounded-full font-bold text-white ring-2 ring-surface`}
          style={{ backgroundColor: `hsl(${hue(n)} 55% 45%)` }}
        >
          {initial(n)}
        </span>
      ))}
      {rest > 0 && (
        <span
          aria-hidden
          className={`${dim} -ml-1.5 inline-flex items-center justify-center rounded-full bg-surface-muted font-bold text-fg-muted ring-2 ring-surface`}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}

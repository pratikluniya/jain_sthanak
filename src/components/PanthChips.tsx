// Panth filter chips with counts (19 Nov 2026). Tapping the selected chip again shows all panths.
import Link from "next/link";
import type { Panth } from "@prisma/client";
import { PANTHS, PANTH_BADGE, PANTH_RING } from "@/lib/panth";

export default function PanthChips({
  path, params, current, counts, t,
}: {
  path: string;
  params: Record<string, string | undefined | null>; // the other filters of the page, kept when a chip is tapped
  current: Panth | null;
  counts: Record<Panth, number>;
  t: { panth: string } & Record<Panth, string>;
}) {
  const href = (p: Panth | null) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    if (p) q.set("panth", p);
    const s = q.toString();
    return s ? `${path}?${s}` : path;
  };
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-xs text-stone-500">{t.panth}:</span>
      {PANTHS.filter((p) => counts[p] > 0 || current === p).map((p) => (
        <Link
          key={p}
          href={href(current === p ? null : p)}
          className={`${PANTH_BADGE[p]} ${current === p ? `font-semibold ${PANTH_RING[p]}` : "opacity-70 hover:opacity-100"}`}
          aria-pressed={current === p}
        >
          {t[p]} · {counts[p]}
        </Link>
      ))}
    </div>
  );
}

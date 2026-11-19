// Panth filter and colours (decided 19 Nov 2026).
//  - Families, Members and Voters lists have panth chips with counts (?panth=STHANAKVASI ...); a download gives the same rows.
//  - A family whose panth is still "to verify" counts under the panth written on its form, and keeps its amber "to verify" tag.
//  - Every panth has its own colour wherever it is shown. Amber stays for "to verify" only.
// Class names are written out in full so Tailwind keeps them.
import type { Panth } from "@prisma/client";

export const PANTHS = ["STHANAKVASI", "MANDIRMARGI", "TERAPANTH", "DIGAMBAR", "UNKNOWN"] as const satisfies readonly Panth[];

export const asPanth = (v: string | null | undefined): Panth | null => ((PANTHS as readonly string[]).includes(v ?? "") ? (v as Panth) : null);

/** Light badge for a panth. */
export const PANTH_BADGE: Record<Panth, string> = {
  STHANAKVASI: "badge bg-green-100 text-green-800",
  MANDIRMARGI: "badge bg-sky-100 text-sky-800",
  TERAPANTH: "badge bg-violet-100 text-violet-800",
  DIGAMBAR: "badge bg-pink-100 text-pink-800",
  UNKNOWN: "badge bg-stone-100 text-stone-700",
};

/** Solid colour for a selected panth button. */
export const PANTH_SOLID: Record<Panth, string> = {
  STHANAKVASI: "bg-green-700 text-white border-green-700",
  MANDIRMARGI: "bg-sky-700 text-white border-sky-700",
  TERAPANTH: "bg-violet-700 text-white border-violet-700",
  DIGAMBAR: "bg-pink-700 text-white border-pink-700",
  UNKNOWN: "bg-stone-600 text-white border-stone-600",
};

/** Ring shown on the chip that is selected. */
export const PANTH_RING: Record<Panth, string> = {
  STHANAKVASI: "ring-1 ring-green-400",
  MANDIRMARGI: "ring-1 ring-sky-400",
  TERAPANTH: "ring-1 ring-violet-400",
  DIGAMBAR: "ring-1 ring-pink-400",
  UNKNOWN: "ring-1 ring-stone-400",
};

/** How many of each panth, in PANTHS order. */
export function panthCounts<T>(items: T[], panthOf: (x: T) => Panth): Record<Panth, number> {
  const c = Object.fromEntries(PANTHS.map((p) => [p, 0])) as Record<Panth, number>;
  for (const x of items) c[panthOf(x)]++;
  return c;
}

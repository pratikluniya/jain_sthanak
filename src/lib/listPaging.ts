// "Load more" lists (4 Nov 2026): every list starts with 10 rows; the address keeps how many are shown (?n=30),
// so Back, refresh and shared links keep the same rows. Search and downloads still cover every row.
export const STEP = 10;

/** How many rows to show: from ?n=, at least STEP, at most the total. */
export function shownCount(raw: string | undefined, total: number): number {
  const n = parseInt(raw ?? "", 10);
  return Math.min(total, Math.max(STEP, Number.isFinite(n) ? n : STEP));
}

/** Link to the same list with `count` rows (filters kept, empty values left out). */
export function moreHref(params: Record<string, string | undefined>, count: number): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  q.set("n", String(count));
  return `?${q.toString()}`;
}

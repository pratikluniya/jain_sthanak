// Short memory of the voter calculation (4 Nov 2026). The Dashboard, Voters screen, public search and downloads
// all run the voter rules over every member; when several people open them within a few seconds, the result
// is reused. Every save writes an audit entry, and audit() clears this memory, so a change shows at once.
export const VOTER_CACHE_MS = 15000;

type Entry = { at: number; value: Promise<unknown> };
const g = globalThis as unknown as { __voterCache?: Entry };

export function cachedVoters<T>(make: () => Promise<T>, now = Date.now()): Promise<T> {
  const hit = g.__voterCache;
  if (hit && now - hit.at < VOTER_CACHE_MS) return hit.value as Promise<T>;
  const value = make();
  g.__voterCache = { at: now, value };
  value.catch(() => {
    if (g.__voterCache?.value === value) g.__voterCache = undefined; // never keep a failure
  });
  return value;
}

export function forgetVoters() {
  g.__voterCache = undefined;
}

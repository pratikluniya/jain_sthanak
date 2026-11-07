/** keep: the tab the search runs in (e.g. { gap: "nomobile" }), so searching stays inside that tab (7 Nov 2026). */
export default function SearchBox({ q, placeholder, label, extra, keep }: { q: string; placeholder: string; label: string; extra?: React.ReactNode; keep?: Record<string, string | undefined | null> }) {
  return (
    <form className="flex gap-2" role="search">
      <input name="q" defaultValue={q} placeholder={placeholder} className="input flex-1" autoComplete="off" />
      {Object.entries(keep ?? {}).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      {extra}
      <button className="btn-primary">{label}</button>
    </form>
  );
}

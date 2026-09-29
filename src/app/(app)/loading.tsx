// Shown instantly while a page's data loads.
export default function Loading() {
  return (
    <div className="space-y-3 animate-pulse" aria-busy="true">
      <div className="h-7 w-40 rounded bg-stone-200" />
      <div className="h-11 rounded-lg bg-stone-200" />
      <div className="grid gap-2 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card p-3 space-y-2">
            <div className="h-4 w-2/3 rounded bg-stone-200" />
            <div className="h-3 w-1/2 rounded bg-stone-100" />
            <div className="h-3 w-1/3 rounded bg-stone-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

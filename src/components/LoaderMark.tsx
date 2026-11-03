// The Sangh logo used as a loader: a faint grey copy with the coloured logo filling it from the top down.
// `cut` = how much of the coloured logo is still hidden at the bottom (100 = empty, 0 = full).
// Plain component (no hooks) so the server-rendered first-load overlay and the client overlay share it.

export default function LoaderMark({ cut }: { cut?: number }) {
  return (
    <div className="loader-logo" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="loader-ghost" src="/loader-logo.webp" alt="" width={110} height={158} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="loader-fill"
        src="/loader-logo.webp"
        alt=""
        width={110}
        height={158}
        style={cut == null ? undefined : ({ "--cut": `${cut}%` } as React.CSSProperties)}
      />
    </div>
  );
}

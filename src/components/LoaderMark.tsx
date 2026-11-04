// The Sangh logo used as a loader: a faint grey copy, and the coloured logo filling it from the top down
// again and again (CSS animation "loader-loop" in globals.css) until the work is done.
// Plain component (no hooks) so the server-rendered first-load overlay and the client overlay share it.

export default function LoaderMark() {
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
      />
    </div>
  );
}

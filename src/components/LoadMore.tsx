"use client";
// "Load more" under a list: a button, and the next rows also load by themselves when the bottom of the list
// comes into view (4 Nov 2026). A small spinner on the button replaces the full-screen logo loader here.
import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { quietLoader } from "@/lib/loader";
import { STEP } from "@/lib/listPaging";

export default function LoadMore(p: { shown: number; total: number; nextHref: string; t: { more: string; loading: string; shownOf: string } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const sentinel = useRef<HTMLDivElement>(null);
  const endQuiet = useRef<null | (() => void)>(null);
  const left = p.total - p.shown;

  const finish = () => {
    endQuiet.current?.();
    endQuiet.current = null;
  };

  const load = () => {
    if (endQuiet.current || left <= 0) return; // already loading, or nothing left
    endQuiet.current = quietLoader();
    setTimeout(finish, 20000); // never keep the screen loader off for long
    start(() => router.replace(p.nextHref, { scroll: false }));
  };

  // the longer list is on screen: let the screen loader work normally again
  useEffect(() => {
    if (!pending) finish();
  }, [pending, p.shown]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || left <= 0 || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && load(), { rootMargin: "200px 0px" });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.shown, p.total, p.nextHref]);

  useEffect(() => finish, []);

  if (p.total === 0) return null;
  return (
    <div ref={sentinel} className="no-print flex flex-col items-center gap-1.5 py-3">
      <span className="text-xs text-stone-500">{p.t.shownOf.replace("{n}", String(p.shown)).replace("{total}", String(p.total))}</span>
      {left > 0 && (
        <button type="button" className="btn-secondary min-w-40" onClick={load} disabled={pending}>
          {pending ? (
            <>
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" aria-hidden="true" />
              {p.t.loading}
            </>
          ) : (
            `${p.t.more} (${Math.min(STEP, left)})`
          )}
        </button>
      )}
    </div>
  );
}

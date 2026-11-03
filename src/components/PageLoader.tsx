"use client";
// Logo loader over the whole screen while a page loads, a form saves, or a file uploads/downloads
// (decided 3 Nov 2026: after 0.5 s, every screen; 4 Nov: the logo fills top to bottom in a loop, with
// "please wait" only, instead of a progress percentage).
//  - Busy state: src/lib/loader.ts (every fetch except link prefetching, plus explicit tasks).
//  - Link clicks, GET forms (e.g. public search) and back/forward start a navigation task that ends
//    when the address changes, or when its requests finish without a change, or after NAV_CAP_MS.
//  - Links marked data-download are fetched here so the loader covers the download, then saved.
import { useEffect, useRef, useState } from "react";
import LoaderMark from "./LoaderMark";
import {
  SHOW_AFTER_MS,
  fetchCount,
  fileNameFrom,
  inflightCount,
  installFetchTracking,
  isBusy,
  resetBusy,
  startTask,
  subscribe,
  type BusyTask,
} from "@/lib/loader";

const NAV_CAP_MS = 20000;
const IDLE_GRACE_MS = 150; // bridges "upload finished -> next page starts" without a flicker
const TICK_MS = 100;

interface Nav {
  task: BusyTask;
  url: string;
  fetchesAtStart: number;
  startedAt: number;
}

const here = () => location.pathname + location.search;

export default function PageLoader({ t }: { t: { wait: string; label: string } }) {
  const [shown, setShown] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const busySince = useRef<number | null>(null);
  const idleSince = useRef<number | null>(null);
  const shownRef = useRef(false);
  const nav = useRef<Nav | null>(null);

  useEffect(() => {
    installFetchTracking();
    // first-load overlay from the root layout: hide it (not remove: React still owns that element)
    const boot = document.getElementById("boot-loader");
    if (boot) boot.style.display = "none";

    const endNav = () => {
      nav.current?.task.end();
      nav.current = null;
    };
    const startNav = () => {
      endNav();
      nav.current = { task: startTask(), url: here(), fetchesAtStart: fetchCount(), startedAt: Date.now() };
    };

    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href) return;
      if (a.getAttribute("aria-disabled") === "true") return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (a.hasAttribute("data-download")) {
        e.preventDefault();
        void download(url.toString());
        return;
      }
      if (a.target && a.target !== "_self") return;
      if (a.hasAttribute("download")) return;
      if (url.pathname.startsWith("/api/")) return; // plain file links: the browser shows its own download
      if (url.pathname + url.search === here()) return; // same page or only a #hash
      startNav();
    };

    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;
      if (e.defaultPrevented) return; // waiting for the confirm popup, or handled by the page itself
      if ((form.getAttribute("method") ?? "").toLowerCase() === "get") startNav();
      // POST forms are server actions: their request is tracked by the fetch wrapper
    };

    const onPopState = () => startNav();
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return; // restored from the back/forward cache: nothing is loading
      endNav();
      resetBusy();
    };

    async function download(href: string) {
      const task = startTask();
      try {
        const res = await fetch(href, { credentials: "same-origin" });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        const name = fileNameFrom(res.headers.get("content-disposition"), "download.xlsx");
        const obj = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = obj;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(obj), 10000);
      } catch {
        location.href = href; // let the browser try the normal way (it also shows any error page)
      } finally {
        task.end();
      }
    }

    const tick = () => {
      const now = Date.now();
      const n = nav.current;
      if (n) {
        const moved = here() !== n.url;
        const settled = fetchCount() > n.fetchesAtStart && inflightCount() === 0 && now - n.startedAt > 300;
        if (moved || settled || now - n.startedAt > NAV_CAP_MS) endNav();
      }

      if (isBusy()) {
        idleSince.current = null;
        if (busySince.current == null) busySince.current = now;
        if (!shownRef.current && now - busySince.current >= SHOW_AFTER_MS) {
          shownRef.current = true;
          setLeaving(false);
          setShown(true);
        }
        return;
      }

      if (busySince.current == null) return;
      if (idleSince.current == null) idleSince.current = now;
      if (now - idleSince.current < IDLE_GRACE_MS) return;
      busySince.current = null;
      idleSince.current = null;
      if (shownRef.current) {
        shownRef.current = false;
        setLeaving(true);
        setTimeout(() => {
          if (!shownRef.current) setShown(false);
        }, 350);
      }
    };

    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("pageshow", onPageShow);
    const unsub = subscribe(tick);
    const timer = setInterval(tick, TICK_MS);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pageshow", onPageShow);
      unsub();
      clearInterval(timer);
      endNav();
    };
  }, []);

  if (!shown) return null;
  return (
    <div className={`loader-ov no-print ${leaving ? "loader-leaving" : ""}`} role="status" aria-live="polite" aria-label={t.label}>
      <LoaderMark />
      <p className="mt-3 text-[13px] text-stone-600">{t.wait}</p>
    </div>
  );
}

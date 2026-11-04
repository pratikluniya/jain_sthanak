"use client";
// Global "busy" state behind the logo loader (decided 3 Nov 2026).
// Busy = at least one tracked network request in flight, or an explicit task (import, PDF, navigation).
// The overlay (components/PageLoader.tsx) shows only when busy lasts longer than SHOW_AFTER_MS.

export const SHOW_AFTER_MS = 500;

type Listener = () => void;

interface Task {
  id: number;
  progress: number | null; // 0..1 when the caller knows real progress
}

let inflight = 0;
let fetchSeen = 0; // counts every tracked request ever started (used by navigation tasks)
let nextId = 1;
const tasks = new Map<number, Task>();
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function isBusy(): boolean {
  if (quiet > 0) return false; // a "load more" shows its own small spinner instead
  return inflight > 0 || tasks.size > 0 || pagePlaceholderVisible();
}

let quiet = 0;
/** Keep the full-screen loader off until the returned function is called (used by "load more" lists). */
export function quietLoader(): () => void {
  quiet++;
  emit();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    quiet = Math.max(0, quiet - 1);
    emit();
  };
}

/** Real progress of the slowest task that reports one (0..1), or null when nobody knows it. */
export function knownProgress(): number | null {
  let best: number | null = null;
  tasks.forEach((t) => {
    if (t.progress != null) best = best == null ? t.progress : Math.min(best, t.progress);
  });
  return best;
}

export function fetchCount(): number {
  return fetchSeen;
}

export function inflightCount(): number {
  return inflight;
}

export interface BusyTask {
  /** Real progress 0..1 (optional). */
  progress(fraction: number): void;
  end(): void;
}

/** Keep the loader on until end() is called (e.g. a batch import or building a PDF). */
export function startTask(): BusyTask {
  const id = nextId++;
  tasks.set(id, { id, progress: null });
  emit();
  let done = false;
  return {
    progress(f: number) {
      const t = tasks.get(id);
      if (!t) return;
      t.progress = Math.max(0, Math.min(1, f));
      emit();
    },
    end() {
      if (done) return;
      done = true;
      tasks.delete(id);
      emit();
    },
  };
}

/** Clear everything (page restored from the back/forward cache). */
export function resetBusy() {
  inflight = 0;
  tasks.clear();
  emit();
}

/** Requests the loader ignores: Next.js link prefetching and anything marked x-no-loader. */
export function shouldTrack(headers: HeadersInit | undefined): boolean {
  if (!headers) return true;
  const get = (k: string): string | null => {
    if (typeof Headers !== "undefined" && headers instanceof Headers) return headers.get(k);
    if (Array.isArray(headers)) {
      const hit = headers.find(([n]) => n.toLowerCase() === k.toLowerCase());
      return hit ? hit[1] : null;
    }
    const rec = headers as Record<string, string>;
    const key = Object.keys(rec).find((n) => n.toLowerCase() === k.toLowerCase());
    return key ? rec[key] : null;
  };
  if (get("next-router-prefetch")) return false;
  if (get("x-no-loader")) return false;
  return true;
}

let installed = false;

/** Wrap window.fetch once so page changes, server actions, uploads and downloads count as busy. */
export function installFetchTracking() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = init?.headers ?? (input instanceof Request ? input.headers : undefined);
    if (!shouldTrack(headers)) return original(input, init);
    inflight++;
    fetchSeen++;
    emit();
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      inflight = Math.max(0, inflight - 1);
      emit();
    };
    return original(input, init).then(
      (r) => trackBody(r, done),
      (e) => {
        done();
        throw e;
      },
    );
  };
}

/** Longest time one response body may keep the loader on (a body nobody reads must not block it). */
const BODY_CAP_MS = 30000;

/**
 * fetch() resolves as soon as the server starts answering, but Next.js pages and saves keep streaming
 * their content after that. Count the request as finished only when its body has been read to the end.
 */
function trackBody(r: Response, done: () => void): Response {
  if (!r.body || [101, 204, 205, 304].includes(r.status)) {
    done();
    return r;
  }
  const cap = setTimeout(done, BODY_CAP_MS);
  const finish = () => {
    clearTimeout(cap);
    done();
  };
  const reader = r.body.getReader();
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done: end, value } = await reader.read();
        if (end) {
          controller.close();
          finish();
        } else controller.enqueue(value);
      } catch (e) {
        controller.error(e);
        finish();
      }
    },
    cancel(reason) {
      finish();
      return reader.cancel(reason);
    },
  });
  const copy = new Response(body, { status: r.status, statusText: r.statusText, headers: r.headers });
  // keep what Next.js reads from the original response (final address after redirects)
  Object.defineProperty(copy, "url", { value: r.url });
  Object.defineProperty(copy, "redirected", { value: r.redirected });
  Object.defineProperty(copy, "type", { value: r.type });
  return copy;
}

/** A page still showing its loading placeholder (app/(app)/loading.tsx) counts as busy. */
export function pagePlaceholderVisible(): boolean {
  return typeof document !== "undefined" && document.querySelector("[data-page-loading]") != null;
}

/**
 * Estimated fill (0..100) when the real progress is unknown: quick at first, slowing near 90.
 * elapsedMs counts from the moment the work started.
 */
export function estimatePercent(elapsedMs: number): number {
  return 90 * (1 - Math.exp(-elapsedMs / 2500));
}

/** File name from a Content-Disposition header, or the fallback. */
export function fileNameFrom(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const star = /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(disposition);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ""));
    } catch {
      /* fall through */
    }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(disposition);
  return plain ? plain[1].trim() : fallback;
}

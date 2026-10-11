"use client";
// Toasts (success / error after an action) and the app-styled confirm popup (decided 11 Oct 2026).
//  - Toasts: server actions set the "flash" cookie (src/lib/flash.ts); this host checks it every
//    few hundred ms (works after redirects and client navigation), shows the toast and clears it.
//    Success hides after 4 s; errors stay until closed.
//  - Confirm: every form submit asks first, except forms/buttons marked data-noconfirm, GET forms
//    and search forms. data-confirm="..." sets the question, data-danger makes the button red.
//    Components can also call askConfirm() from src/lib/uiBus.ts.
import { useCallback, useEffect, useRef, useState } from "react";
import { registerFeedback, type ConfirmOptions, type ToastKind } from "@/lib/uiBus";

export interface FeedbackLabels {
  toasts: Record<string, string>; // key -> text, may contain {n}
  confirmTitle: string;
  confirmSave: string;
  confirmDanger: string;
  yes: string;
  cancel: string;
  close: string;
}

interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

const OK_MS = 4000;

function readFlash(): { k: ToastKind; m: string; n?: number } | null {
  const raw = document.cookie.split("; ").find((c) => c.startsWith("flash="));
  if (!raw) return null;
  document.cookie = "flash=; path=/; max-age=0; samesite=lax";
  // the server may URL-encode the value once more when it sets the cookie: decode until it is JSON
  let v = raw.slice(6);
  for (let i = 0; i < 3 && !v.startsWith("{"); i++) {
    try {
      v = decodeURIComponent(v);
    } catch {
      return null;
    }
  }
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

export default function Feedback({ t }: { t: FeedbackLabels }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [ask, setAsk] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const nextId = useRef(1);
  const okBtn = useRef<HTMLButtonElement>(null);

  const remove = useCallback((id: number) => setToasts((all) => all.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (kind: ToastKind, text: string) => {
      const id = nextId.current++;
      setToasts((all) => [...all.slice(-3), { id, kind, text }]);
      if (kind === "ok") setTimeout(() => remove(id), OK_MS);
    },
    [remove],
  );
  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setAsk({ ...o, resolve })), []);

  useEffect(() => registerFeedback(push, confirm), [push, confirm]);

  // flash cookie set by a server action (or before a client redirect)
  useEffect(() => {
    const check = () => {
      const f = readFlash();
      if (!f) return;
      const text = (t.toasts[f.m] ?? f.m).replace("{n}", String(f.n ?? ""));
      push(f.k === "err" ? "err" : "ok", text);
    };
    check();
    const timer = setInterval(check, 400);
    return () => clearInterval(timer);
  }, [push, t.toasts]);

  // confirm before any form is submitted
  useEffect(() => {
    const confirmed = new WeakSet<HTMLFormElement>();
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;
      const btn = e.submitter as HTMLElement | null;
      if (confirmed.has(form)) {
        confirmed.delete(form);
        return;
      }
      if (
        form.hasAttribute("data-noconfirm") ||
        btn?.hasAttribute("data-noconfirm") ||
        form.getAttribute("role") === "search" ||
        (form.getAttribute("method") ?? "").toLowerCase() === "get"
      )
        return;
      e.preventDefault();
      e.stopPropagation();
      const danger = btn?.hasAttribute("data-danger") || form.hasAttribute("data-danger");
      const message = btn?.dataset.confirm || form.dataset.confirm || (danger ? t.confirmDanger : t.confirmSave);
      confirm({ message, danger }).then((ok) => {
        if (!ok) return;
        confirmed.add(form);
        if (btn && (btn instanceof HTMLButtonElement || btn instanceof HTMLInputElement)) form.requestSubmit(btn);
        else form.requestSubmit();
      });
    };
    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, [confirm, t.confirmDanger, t.confirmSave]);

  useEffect(() => {
    if (!ask) return;
    okBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        ask.resolve(false);
        setAsk(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ask]);

  const answer = (ok: boolean) => {
    ask?.resolve(ok);
    setAsk(null);
  };

  return (
    <>
      <div className="no-print pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3" aria-live="polite">
        {toasts.map((x) => (
          <div
            key={x.id}
            role={x.kind === "err" ? "alert" : "status"}
            className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${
              x.kind === "ok" ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-900"
            }`}
          >
            <span aria-hidden="true" className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${x.kind === "ok" ? "bg-green-600" : "bg-red-600"}`}>
              {x.kind === "ok" ? "✓" : "!"}
            </span>
            <span className="flex-1 leading-snug">{x.text}</span>
            <button type="button" onClick={() => remove(x.id)} className="-mr-1 rounded p-0.5 opacity-60 hover:opacity-100" aria-label={t.close}>
              ✕
            </button>
          </div>
        ))}
      </div>

      {ask && (
        <div className="no-print fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={() => answer(false)}>
          <div role="alertdialog" aria-modal="true" aria-label={t.confirmTitle} className="w-full rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-sm sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-heading text-lg font-bold">{t.confirmTitle}</h2>
            <p className="mt-2 text-[15px] text-stone-700">{ask.message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => answer(false)}>
                {t.cancel}
              </button>
              <button type="button" ref={okBtn} className={ask.danger ? "btn-danger" : "btn-primary"} onClick={() => answer(true)}>
                {ask.okLabel ?? t.yes}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

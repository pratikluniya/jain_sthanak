"use client";
// Tiny browser-side bus between any component and the <Feedback> host (toasts + confirm popup).

export type ToastKind = "ok" | "err";
export interface ConfirmOptions {
  message?: string;
  danger?: boolean;
  okLabel?: string;
}

type ToastFn = (kind: ToastKind, text: string) => void;
type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>;

let toastFn: ToastFn | null = null;
let confirmFn: ConfirmFn | null = null;

export function registerFeedback(t: ToastFn, c: ConfirmFn) {
  toastFn = t;
  confirmFn = c;
}

export function showToast(kind: ToastKind, text: string) {
  toastFn?.(kind, text);
}

/** App-styled "Are you sure?" popup; resolves true when the user confirms. */
export function askConfirm(o: ConfirmOptions = {}): Promise<boolean> {
  return confirmFn ? confirmFn(o) : Promise.resolve(window.confirm(o.message ?? "OK?"));
}

/** Set a flash message from the browser, shown on the next screen (used before router.push). */
export function flashNext(kind: ToastKind, key: string, n?: number) {
  document.cookie = `flash=${encodeURIComponent(JSON.stringify({ k: kind, m: key, n, t: Date.now() }))}; path=/; max-age=60; samesite=lax`;
}

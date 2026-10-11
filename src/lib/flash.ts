// One-shot success / error message shown as a toast after an action (decided 11 Oct 2026).
// The server action sets a short-lived cookie; the <Feedback> component in the root layout
// picks it up (also after a redirect), shows the toast in the screen language and clears it.
import { cookies } from "next/headers";

export const FLASH_COOKIE = "flash";

/** keys have a translation "toast_<key>" in i18n; anything else is shown as written */
export type FlashKey =
  | "saved"
  | "created"
  | "deleted"
  | "restored"
  | "approved"
  | "rejected"
  | "done"
  | "error"
  | "notAllowed"
  | "checkForm";

export function flash(kind: "ok" | "err", key: FlashKey | string, n?: number) {
  cookies().set(FLASH_COOKIE, encodeURIComponent(JSON.stringify({ k: kind, m: key, n, t: Date.now() })), {
    path: "/",
    maxAge: 60,
    sameSite: "lax",
    httpOnly: false, // the browser clears it after showing the toast
  });
}

export const flashOk = (key: FlashKey, n?: number) => flash("ok", key, n);
export const flashErr = (key: FlashKey | string) => flash("err", key);

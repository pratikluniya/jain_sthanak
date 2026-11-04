// Search on the Upload page's "waiting for check" list (4 Nov 2026): full name, address or mobile,
// Marathi or English, read from what the form reader extracted. Same spelling folding as other searches.
import { matchesSearch, searchKey, toEnglishDigits } from "./normalize";

type Json = Record<string, unknown> | null | undefined;

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Every searchable text of one waiting form, folded with searchKey; mobiles also as plain digits. */
export function uploadSearchText(kind: string, extracted: unknown): string {
  const x = (extracted ?? null) as Json;
  if (!x) return "";
  const parts: string[] = [];
  const phones: string[] = [];
  if (kind === "INDIVIDUAL") {
    for (const k of ["nameRaw", "title", "firstName", "middleName", "surname", "firstNameEn", "middleNameEn", "surnameEn", "homeAddress", "homeAddressEn", "businessAddress"]) parts.push(str(x[k]));
    phones.push(str(x.mobile), str(x.landline));
  } else {
    for (const k of ["headName", "headNameEn", "address", "addressEn"]) parts.push(str(x[k]));
    const members = Array.isArray(x.members) ? (x.members as Json[]) : [];
    for (const m of members) {
      parts.push(str(m?.nameRaw), str(m?.nameEn));
      phones.push(str(m?.mobile));
    }
  }
  const digits = phones.map((p) => toEnglishDigits(p).replace(/\D/g, "")).filter(Boolean);
  return [searchKey(parts.join(" ")), ...digits].join(" ");
}

/** True when every word of the query is found; a query of digits matches any part of a mobile. */
export function uploadMatches(text: string, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  const digitsOnly = toEnglishDigits(q).replace(/[\s-]/g, "");
  if (/^\d{3,}$/.test(digitsOnly)) return text.includes(digitsOnly);
  return matchesSearch(text, q);
}

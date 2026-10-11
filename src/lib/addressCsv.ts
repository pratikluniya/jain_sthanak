// English addresses for families saved before 11 Oct 2026: the admin downloads a CSV
// (code, head, address, English address), the English column is written / checked outside the app,
// and the same file is uploaded back. Only the English address is changed.

/** One CSV cell, quoted when needed. */
const cell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function toCsv(rows: string[][]): string {
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

/** Parses CSV text (quotes, commas and line breaks inside quotes, BOM). */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

export const ADDRESS_CSV_HEADER = ["code", "headName", "address", "addressEn"];
/** forms still waiting for a volunteer's check (decided 11 Oct 2026): keyed by the upload id */
export const FORMS_CSV_HEADER = ["upload", "form", "headName", "address", "addressEn"];

export type AddressCsv = { kind: "family" | "form"; rows: { key: string; addressEn: string }[]; error?: string };

/** Reads the uploaded file: needs "addressEn" plus "code" (families) or "upload" (waiting forms), any order. */
export function readAddressCsv(text: string): AddressCsv {
  const all = parseCsv(text);
  if (!all.length) return { kind: "family", rows: [], error: "empty" };
  const head = all[0].map((h) => h.trim().toLowerCase());
  const ui = head.indexOf("upload");
  const ci = head.indexOf("code");
  const ai = head.indexOf("addressen");
  const kind = ui >= 0 ? "form" : "family";
  const ki = ui >= 0 ? ui : ci;
  if (ki < 0 || ai < 0) return { kind, rows: [], error: "columns" };
  const rows = all.slice(1)
    .map((r) => {
      const k = (r[ki] ?? "").trim();
      return { key: kind === "family" ? k.toUpperCase() : k, addressEn: (r[ai] ?? "").replace(/\s+/g, " ").trim() };
    })
    .filter((r) => r.key);
  return { kind, rows };
}

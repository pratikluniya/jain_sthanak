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

/** Reads the uploaded file: needs columns "code" and "addressEn" (any order). */
export function readAddressCsv(text: string): { rows: { code: string; addressEn: string }[]; error?: string } {
  const all = parseCsv(text);
  if (!all.length) return { rows: [], error: "empty" };
  const head = all[0].map((h) => h.trim().toLowerCase());
  const ci = head.indexOf("code");
  const ai = head.indexOf("addressen");
  if (ci < 0 || ai < 0) return { rows: [], error: "columns" };
  const rows = all.slice(1)
    .map((r) => ({ code: (r[ci] ?? "").trim().toUpperCase(), addressEn: (r[ai] ?? "").replace(/\s+/g, " ").trim() }))
    .filter((r) => r.code);
  return { rows };
}

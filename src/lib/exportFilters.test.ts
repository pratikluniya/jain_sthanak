import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultFieldsFor, fileTag, filterQuery, filtersFrom } from "./exportRows";

const from = (q: Record<string, string>) => filtersFrom((k) => q[k] ?? null);

test("the tab and search on screen go into the download link", () => {
  assert.equal(filterQuery("members", { gap: "nomobile", q: "jain", blood: "B+" }), "&q=jain&blood=B%2B&gap=nomobile");
  assert.equal(filterQuery("members", { memberMode: "moved" }), "&moved=1");
  assert.equal(filterQuery("voters", { tab: "pending" }), "&tab=pending");
  assert.equal(filterQuery("voters", { tab: "eligible" }), "");
  assert.equal(filterQuery("families", { toVerify: true, moved: false }), "&panth=TO_VERIFY");
  assert.equal(filterQuery("donations", { kind: "BHOJAN", year: 2026, show: "PAID" }), "&kind=BHOJAN&year=2026&show=PAID");
  assert.equal(filterQuery("duplicates", { dupKind: "SHARED_MOBILE" }), "&dupKind=SHARED_MOBILE");
});

test("download links are read back to the same filters", () => {
  const f = from({ gap: "nomobile", q: " jain ", tab: "pending", panth: "TO_VERIFY", kind: "BHOJAN", year: "2026", show: "EXEMPT", dupKind: "SHARED_MOBILE" });
  assert.equal(f.gap, "nomobile");
  assert.equal(f.q, "jain");
  assert.equal(f.tab, "pending");
  assert.equal(f.toVerify, true);
  assert.equal(f.kind, "BHOJAN");
  assert.equal(f.year, 2026);
  assert.equal(f.show, "EXEMPT");
  assert.equal(f.dupKind, "SHARED_MOBILE");
  const bad = from({ gap: "x", tab: "x", show: "x", dupKind: "x", year: "abc" });
  assert.deepEqual([bad.gap, bad.tab, bad.show, bad.dupKind, bad.year], [null, "eligible", "UNPAID", null, null]);
});

test("file names say which tab was downloaded", () => {
  assert.equal(fileTag("members", from({ gap: "nomobile" })), "-nomobile");
  assert.equal(fileTag("voters", from({ tab: "pending", q: "jain" })), "-pending-search");
  assert.equal(fileTag("donations", from({ kind: "MAHAVIR_JAYANTI", year: "2026", show: "UNPAID" })), "-mahavir-jayanti-2026-unpaid");
  assert.deepEqual(defaultFieldsFor("voters", { tab: "pending" }).includes("reasons"), true);
});

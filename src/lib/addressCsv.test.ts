import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, readAddressCsv, toCsv } from "./addressCsv";

test("round trip with commas, quotes and line breaks", () => {
  const rows = [["code", "addressEn"], ["NR-0001", 'A-4, "Hari" Niwas, Road\nNashik']];
  assert.deepEqual(parseCsv(toCsv(rows)), rows);
});
test("reads code and addressEn in any order, skips blank codes", () => {
  const r = readAddressCsv("addressEn,code,x\nJail Road,nr-0002,1\n,,\n Plot  5 ,NR-0003,\n");
  assert.deepEqual(r.rows, [{ key: "NR-0002", addressEn: "Jail Road" }, { key: "NR-0003", addressEn: "Plot 5" }]);
});
test("missing column is an error", () => {
  assert.equal(readAddressCsv("code,address\nNR-1,x").error, "columns");
});
test("waiting forms file is keyed by upload id (case kept)", () => {
  const r = readAddressCsv("upload,form,headName,address,addressEn\ncmAbC1,forms-batch-02/A1.jpg,x,y,Jail Road\n");
  assert.equal(r.kind, "form");
  assert.deepEqual(r.rows, [{ key: "cmAbC1", addressEn: "Jail Road" }]);
});

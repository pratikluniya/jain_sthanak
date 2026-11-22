import { test } from "node:test";
import assert from "node:assert/strict";
import { cellText, scriptRuns } from "./pdfText";

test("PDF hidden text: Devanagari and Latin runs", () => {
  assert.deepEqual(scriptRuns("साबद्रा स्मिता प्रमोद"), [{ dev: true, text: "साबद्रा स्मिता प्रमोद" }]);
  assert.deepEqual(scriptRuns("फ्लॅट नं. 14, NR-0409"), [
    { dev: true, text: "फ्लॅट नं" },
    { dev: false, text: ". 14, NR-0409" },
  ]);
  assert.deepEqual(scriptRuns("Total: 1466 ✔"), [{ dev: false, text: "Total: 1466 " }], "letters Helvetica lacks are dropped");
  assert.equal(cellText("  साबद्रा\n स्मिता  "), "साबद्रा स्मिता");
});

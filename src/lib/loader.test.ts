import { test } from "node:test";
import assert from "node:assert/strict";
import { estimatePercent, fileNameFrom, isBusy, knownProgress, shouldTrack, startTask } from "./loader";

test("estimated fill rises fast, slows down and never reaches 90", () => {
  assert.equal(estimatePercent(0), 0);
  assert.ok(estimatePercent(1000) > 25);
  assert.ok(estimatePercent(5000) > estimatePercent(2000));
  assert.ok(estimatePercent(60000) < 90);
});

test("download file name comes from Content-Disposition", () => {
  assert.equal(fileNameFrom('attachment; filename="voters-2026.xlsx"', "x.xlsx"), "voters-2026.xlsx");
  assert.equal(fileNameFrom("attachment; filename*=UTF-8''%E0%A4%AE%E0%A4%A4.xlsx", "x.xlsx"), "मत.xlsx");
  assert.equal(fileNameFrom(null, "x.xlsx"), "x.xlsx");
});

test("link prefetching and marked requests are not tracked", () => {
  assert.equal(shouldTrack(undefined), true);
  assert.equal(shouldTrack({ RSC: "1" }), true);
  assert.equal(shouldTrack({ "Next-Router-Prefetch": "1", RSC: "1" }), false);
  assert.equal(shouldTrack([["x-no-loader", "1"]]), false);
});

test("tasks keep the loader busy and report the slowest real progress", () => {
  assert.equal(isBusy(), false);
  const a = startTask();
  const b = startTask();
  assert.equal(isBusy(), true);
  assert.equal(knownProgress(), null);
  a.progress(0.8);
  b.progress(0.3);
  assert.equal(knownProgress(), 0.3);
  b.end();
  assert.equal(knownProgress(), 0.8);
  a.end();
  a.end(); // ending twice is harmless
  assert.equal(isBusy(), false);
});

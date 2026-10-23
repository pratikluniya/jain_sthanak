import { test } from "node:test";
import assert from "node:assert/strict";
import { unpaidStreak, type CellStatus } from "./donations";

const of = (m: Record<number, CellStatus>) => (y: number) => m[y] ?? "UNPAID";

test("counts unpaid years in a row back from the newest", () => {
  assert.equal(unpaidStreak([2029, 2028, 2027, 2026], of({ 2026: "PAID" })), 3);
  assert.equal(unpaidStreak([2029, 2028, 2027, 2026], of({ 2029: "PAID" })), 0);
  assert.equal(unpaidStreak([2029, 2028, 2027, 2026], of({})), 4);
});

test("exempt years are skipped, not counted and not a break", () => {
  assert.equal(unpaidStreak([2029, 2028, 2027, 2026], of({ 2028: "EXEMPT", 2026: "PAID" })), 2);
  assert.equal(unpaidStreak([2027, 2026], of({ 2027: "EXEMPT", 2026: "EXEMPT" })), 0);
});

test("no open years means nothing owed", () => {
  assert.equal(unpaidStreak([], of({})), 0);
});

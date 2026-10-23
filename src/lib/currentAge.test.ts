import { test } from "node:test";
import assert from "node:assert/strict";
import { ageFromDobString, currentAge } from "./eligibility";

const d = (s: string) => new Date(`${s}T00:00:00`);

test("age from DOB grows on the birthday", () => {
  const m = { dob: d("1980-10-23"), age: null, ageRecordedOn: null };
  assert.equal(currentAge(m, d("2026-10-22")), 45);
  assert.equal(currentAge(m, d("2026-10-23")), 46);
});

test("age without DOB grows by whole years since it was read", () => {
  const m = { dob: null, age: 45, ageRecordedOn: d("2026-10-01") };
  assert.equal(currentAge(m, d("2027-09-30")), 45);
  assert.equal(currentAge(m, d("2027-10-01")), 46);
  assert.equal(currentAge({ dob: null, age: null, ageRecordedOn: null }), null);
});

test("age box value from a typed DOB", () => {
  assert.equal(ageFromDobString("2000-01-15", d("2026-10-23")), "26");
  assert.equal(ageFromDobString("", d("2026-10-23")), "");
  assert.equal(ageFromDobString("2030-01-01", d("2026-10-23")), "");
});

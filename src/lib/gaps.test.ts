import { test } from "node:test";
import assert from "node:assert/strict";
import { aadhaarPendingCount, hasAadhaarImage, memberGaps } from "./gaps";

const base = { status: "ACTIVE", kycFileKey: null, kycDocType: null, aadhaarBackKey: null, photoKey: null, mobile: "", age: null, dob: null };
const today = new Date("2026-10-12");

test("flags a living member with nothing on file", () => {
  assert.deepEqual(memberGaps(base, today), ["noaadhaar", "nophoto", "nomobile", "nodob", "noage"]);
  assert.ok(!memberGaps({ ...base, mobile: "9800000001" }, today).includes("nomobile"));
});
test("front alone (or back alone) is enough for Aadhaar", () => {
  assert.equal(hasAadhaarImage({ ...base, kycFileKey: "f.jpg", kycDocType: "AADHAAR" }), true);
  assert.equal(hasAadhaarImage({ ...base, kycFileKey: "f.jpg" }), true);
  assert.equal(hasAadhaarImage({ ...base, aadhaarBackKey: "b.jpg" }), true);
});
test("a PAN card is not an Aadhaar", () => {
  assert.equal(hasAadhaarImage({ ...base, kycFileKey: "p.jpg", kycDocType: "PAN" }), false);
});
test("Aadhaar is flagged only for 18+ or unknown age", () => {
  assert.ok(!memberGaps({ ...base, age: 12, ageRecordedOn: today }, today).includes("noaadhaar"));
  assert.ok(memberGaps({ ...base, age: 18, ageRecordedOn: today }, today).includes("noaadhaar"));
  assert.ok(!memberGaps({ ...base, dob: new Date("2015-01-01") }, today).includes("noaadhaar"));
  assert.ok(memberGaps({ ...base }, today).includes("noaadhaar"));
});
test("DOB flag even with age; age flag only when both are empty", () => {
  const g = memberGaps({ ...base, age: 40 }, today);
  assert.ok(g.includes("nodob") && !g.includes("noage"));
  const d = memberGaps({ ...base, dob: new Date("1980-01-01") }, today);
  assert.ok(!d.includes("nodob") && !d.includes("noage"));
});
test("family count of 18+ members without Aadhaar", () => {
  const withA = { ...base, age: 40, kycFileKey: "a.jpg" };
  const child = { ...base, age: 8, ageRecordedOn: today };
  assert.equal(aadhaarPendingCount([withA, child], today), 0);
  assert.equal(aadhaarPendingCount([withA, child, { ...base, age: 45 }], today), 1);
});
test("never flags deceased or moved-out members", () => {
  assert.deepEqual(memberGaps({ ...base, status: "DECEASED" }, today), []);
  assert.deepEqual(memberGaps({ ...base, status: "MOVED_OUT" }, today), []);
});

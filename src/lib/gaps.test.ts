import { test } from "node:test";
import assert from "node:assert/strict";
import { hasAadhaarImage, memberGaps } from "./gaps";

const base = { status: "ACTIVE", kycFileKey: null, kycDocType: null, aadhaarBackKey: null, photoKey: null, mobile: "", age: null, dob: null };

test("flags a living member with nothing on file", () => {
  assert.deepEqual(memberGaps(base), ["noaadhaar", "nophoto", "nomobile", "noage"]);
  assert.ok(!memberGaps({ ...base, mobile: "9800000001" }).includes("nomobile"));
});
test("front alone (or back alone) is enough for Aadhaar", () => {
  assert.equal(hasAadhaarImage({ ...base, kycFileKey: "f.jpg", kycDocType: "AADHAAR" }), true);
  assert.equal(hasAadhaarImage({ ...base, kycFileKey: "f.jpg" }), true);
  assert.equal(hasAadhaarImage({ ...base, aadhaarBackKey: "b.jpg" }), true);
});
test("a PAN card is not an Aadhaar", () => {
  assert.equal(hasAadhaarImage({ ...base, kycFileKey: "p.jpg", kycDocType: "PAN" }), false);
});
test("age or date of birth clears the age flag", () => {
  assert.ok(!memberGaps({ ...base, age: 40 }).includes("noage"));
  assert.ok(!memberGaps({ ...base, dob: new Date("1980-01-01") }).includes("noage"));
});
test("never flags deceased or moved-out members", () => {
  assert.deepEqual(memberGaps({ ...base, status: "DECEASED" }), []);
  assert.deepEqual(memberGaps({ ...base, status: "MOVED_OUT" }), []);
});

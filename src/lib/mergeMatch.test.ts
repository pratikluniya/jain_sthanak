import { test } from "node:test";
import assert from "node:assert/strict";
import { guessMatches, mergeDiff, type ExistingMember, type FormRow } from "./mergeMatch";

const ex = (o: Partial<ExistingMember>): ExistingMember => ({
  id: "m", name: "", firstName: "", middleName: "", surname: "", firstNameEn: "", middleNameEn: "", surnameEn: "",
  mobile: "", age: null, dob: null, education: "", occupation: "", bloodGroup: "", hasKyc: false, ...o,
});
const row = (o: Partial<FormRow>): FormRow => ({
  key: "r", firstName: "", middleName: "", surname: "", firstNameEn: "", middleNameEn: "", surnameEn: "",
  mobile: "", age: "", dob: "", education: "", occupation: "", bloodGroup: "", ...o,
});

test("rows match existing members by first name or mobile, one to one", () => {
  const existing = [ex({ id: "a", firstName: "रमेश", surname: "बोथरा" }), ex({ id: "b", firstName: "सुनीता", surname: "बोथरा", mobile: "9800000002" })];
  const rows = [
    row({ key: "r1", firstName: "रमेश", surname: "बोथरा" }),
    row({ key: "r2", firstName: "सुनिता", mobile: "9800000002" }), // spelling differs, same mobile
    row({ key: "r3", firstName: "प्रिया", surname: "बोथरा" }), // new
  ];
  assert.deepEqual(guessMatches(rows, existing), { r1: "a", r2: "b", r3: "" });
});

test("same spelling folds (ण/न, ी/ि) still match", () => {
  const existing = [ex({ id: "a", firstName: "प्रतीक", surname: "लुणिया" })];
  assert.equal(guessMatches([row({ key: "x", firstName: "प्रतिक", surname: "लुनिया" })], existing).x, "a");
});

test("only blank fields are filled; different values are conflicts", () => {
  const m = ex({ mobile: "9800000001", bloodGroup: "", education: "B.Com", age: 40 });
  const d = mergeDiff(row({ mobile: "9800000009", bloodGroup: "o+ve", education: "b.com", age: "45" }), m);
  assert.deepEqual(d.fill, ["bloodGroup"]);
  assert.deepEqual(d.conflicts.map((c) => c.field), ["mobile", "age"]);
});

test("age within a year is not a conflict", () => {
  assert.deepEqual(mergeDiff(row({ age: "41" }), ex({ age: 40 })).conflicts, []);
});

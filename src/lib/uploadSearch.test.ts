import { test } from "node:test";
import assert from "node:assert/strict";
import { uploadMatches, uploadSearchText } from "./uploadSearch";

const family = uploadSearchText("FAMILY", {
  headName: "सौ. निर्मलाबाई कचरदासजी चोरडिया",
  headNameEn: "Sau. Nirmalabai Kachardasji Chordiya",
  address: "जैन भवन समोर, आर्टिलरी सेंटर रोड, नाशिक रोड",
  addressEn: "Opposite Jain Bhavan, Artillery Centre Road, Nashik Road",
  members: [{ nameRaw: "सुनीता अंकित चोरडिया", nameEn: "Sunita Ankit Chordiya", mobile: "९८२२० १२३४५" }],
});
const app = uploadSearchText("INDIVIDUAL", { firstName: "आदित्य", middleName: "कचरदास", surname: "चोरडिया", firstNameEn: "Aditya", surnameEn: "Chordia", homeAddress: "३०१, व्हिजन हाईट, बिटको पॉईंट", mobile: "9876543210" });

test("waiting forms are found by full name in Marathi or English", () => {
  assert.ok(uploadMatches(family, "निर्मला चोरडिया"));
  assert.ok(uploadMatches(family, "sunita chordia"));
  assert.ok(uploadMatches(app, "Aditya Chordiya"));
  assert.ok(uploadMatches(app, "आदित्य कचरदास चोरडिया"));
  assert.ok(!uploadMatches(app, "Rahul Chordiya"));
});

test("waiting forms are found by address words", () => {
  assert.ok(uploadMatches(family, "artillery"));
  assert.ok(uploadMatches(family, "जैन भवन"));
  assert.ok(uploadMatches(app, "बिटको"));
});

test("waiting forms are found by mobile, also partly and written in Devanagari digits", () => {
  assert.ok(uploadMatches(family, "9822012345"));
  assert.ok(uploadMatches(family, "12345"));
  assert.ok(uploadMatches(app, "98765 43210"));
  assert.ok(uploadMatches(app, "९८७६५"));
  assert.ok(!uploadMatches(app, "11111"));
  assert.ok(uploadMatches(app, ""));
});

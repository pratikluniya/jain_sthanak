import { test } from "node:test";
import assert from "node:assert/strict";
import { addressToMarathi, fillMarathi, learnFromPairs, setLearnedNames, toMarathiName } from "./toMarathi";

test("known surnames and titles, rules for the rest", () => {
  setLearnedNames(new Map());
  assert.equal(toMarathiName("Pratik Luniya"), "प्रतिक लुणिया");
  assert.equal(toMarathiName("Shri Nikhil Bhandari"), "श्री निखिल भंडारी");
  assert.equal(toMarathiName("Mohanlalji"), "मोहनलालजी");
});
test("learned spellings win", () => {
  setLearnedNames(learnFromPairs([["कांतिलाल", "Kantilal"], ["राहुल", "Rahul"], ["राहुल", "Rahul"], ["रहुल", "Rahul"]]));
  assert.equal(toMarathiName("Rahul Kantilal Shah"), "राहुल कांतिलाल शाह");
  setLearnedNames(new Map());
});
test("English typed in the Marathi box moves to English; empty Marathi is filled", () => {
  assert.deepEqual(fillMarathi("Pratik", ""), { dev: "प्रतिक", en: "Pratik" });
  assert.deepEqual(fillMarathi("", "Vijay"), { dev: "विजय", en: "Vijay" });
  assert.deepEqual(fillMarathi("प्रतिक", "Pratik"), { dev: "प्रतिक", en: "Pratik" });
});
test("address: common words, near/behind after the place, wing letters kept", () => {
  assert.equal(addressToMarathi("Flat No. 2, Near Jain Bhavan, Nashik Road"), "फ्लॅट नं. 2, जैन भवन जवळ, नाशिक रोड");
  assert.equal(addressToMarathi("B-5, Gopal Nagar"), "B-5, गोपल नगर");
});

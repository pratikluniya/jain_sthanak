import { test } from "node:test";
import assert from "node:assert/strict";
import { addressToEnglish, familyAddress } from "./addressEn";

test("common words translated, landmark words moved after near/behind/opposite", () => {
  assert.equal(addressToEnglish("वर्धमान सोसायटी जैन भवन समोर नाशिकरोड"), "Vardhaman Society, Opposite Jain Bhavan, Nashik Road");
  assert.equal(addressToEnglish("१, महावीर सोसा. जैन स्थानक जवळ, ना.रोड"), "1, Mahavir Society, Near Jain Sthanak, Nashik Road");
  assert.equal(addressToEnglish("ए-४०४, हरी निवास सोसायटी, दत्त मंदिर रोड, मुक्तीधाम मागे, नाशिक रोड"), "E-404, Hari Nivas Society, Datta Mandir Road, Behind Muktidham, Nashik Road");
});
test("English text kept, digits converted", () => {
  assert.equal(addressToEnglish("203, Mahurgad Society, Datt Mandir Road"), "203, Mahurgad Society, Datt Mandir Road");
  assert.equal(addressToEnglish("Flat ३, Jail Road"), "Flat 3, Jail Road");
  assert.equal(addressToEnglish(""), "");
});
test("familyAddress falls back to the original", () => {
  assert.equal(familyAddress({ address: "अ", addressEn: "" }, true), "अ");
  assert.equal(familyAddress({ address: "अ", addressEn: "A" }, true), "A");
  assert.equal(familyAddress({ address: "अ", addressEn: "A" }, false), "अ");
});

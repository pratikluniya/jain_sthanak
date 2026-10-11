import { test } from "node:test";
import assert from "node:assert/strict";
import { addressToEnglish, familyAddress } from "./addressEn";

test("common words translated, landmark words moved after near/behind/opposite", () => {
  assert.equal(addressToEnglish("वर्धमान सोसायटी जैन भवन समोर नाशिकरोड"), "Vardhaman Society, Opposite Jain Bhavan, Nashik Road");
  assert.equal(addressToEnglish("१, महावीर सोसा. जैन स्थानक जवळ, ना.रोड"), "1, Mahavir Society, Near Jain Sthanak, Nashik Road");
  assert.equal(addressToEnglish("ए-४०४, हरी निवास सोसायटी, दत्त मंदिर रोड, मुक्तीधाम मागे, नाशिक रोड"), "A-404, Hari Nivas Society, Datta Mandir Road, Behind Muktidham, Nashik Road");
});
test("wings, joined place words, full stops as separators, spelling variants", () => {
  assert.equal(addressToEnglish("ए-९, जिवन प्रकाश अपार्टमेंट, गोपाळ नगर, नाशिक रोड").startsWith("A-9, "), true);
  assert.equal(addressToEnglish("प्लॅट नं. २०१, नवकार नेक्सस, गोपाळनगर, आर्टिलरी सेंटर रोड").startsWith("Flat No. 201, "), true);
  assert.match(addressToEnglish("प्लॅट नं. २०१, गोपाळनगर"), /Gopal Nagar/);
  const a = addressToEnglish("२५. आश्विनी व्हीला. निसर्गदत्तनगर. जगतापमळा. ना.रोड");
  assert.match(a, /^25, .*Villa, .* Nagar, .* Mala, Nashik Road$/);
  assert.match(addressToEnglish("३-श्री गणेश रेसीडेन्सी, लिंगायत कॉलनी, दे. गांव ना.रोड."), /Residency, Lingayat Colony, Deolali Gaon/);
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

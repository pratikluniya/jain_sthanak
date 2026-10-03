import { test } from "node:test";
import assert from "node:assert/strict";
import { toEnglishDigits, normalizeMobile, normalizeBloodGroup, parseAge, splitName, searchKey, matchesSearch } from "./normalize";
import { relationFromRaw, genderFromRelation } from "./relations";
import { ageOn, checkVoter } from "./eligibility";

test("digits", () => {
  assert.equal(toEnglishDigits("९४२३१९३०६९"), "9423193069");
  assert.equal(parseAge("७८"), 78);
  assert.equal(parseAge("2 वर्ष"), 2);
  assert.equal(parseAge("2 महिने"), 0);
  assert.equal(parseAge("2महि"), 0);
  assert.equal(parseAge(""), null);
});

test("mobile", () => {
  assert.deepEqual(normalizeMobile("९४२३१९३०६९"), { value: "9423193069", valid: true });
  assert.deepEqual(normalizeMobile("+91 98505 21026"), { value: "9850521026", valid: true });
  assert.equal(normalizeMobile("12345").valid, false);
});

test("blood group", () => {
  assert.equal(normalizeBloodGroup("B+ve"), "B+");
  assert.equal(normalizeBloodGroup("O-ve"), "O-");
  assert.equal(normalizeBloodGroup("A +VE"), "A+");
  assert.equal(normalizeBloodGroup("0+"), "O+");
  assert.equal(normalizeBloodGroup("AB-"), "AB-");
  assert.equal(normalizeBloodGroup("-"), "");
});

test("names", () => {
  assert.deepEqual(splitName("सौ. निर्मलाबाई कचरदासजी चोरडिया"), {
    title: "सौ.", firstName: "निर्मलाबाई", middleName: "कचरदासजी", surname: "चोरडिया", deceasedHint: false,
  });
  assert.equal(splitName("कु. रश्मी कांतिलालजी चोरडिया").title, "कु.");
  assert.equal(splitName("कै. माणकलाल छाजेड").deceasedHint, true);
  assert.equal(splitName("श्रीमती आशाबाई सायरचंदजी छाजेड").title, "श्रीमती");
});

test("search key tolerates spelling variation", () => {
  assert.equal(searchKey("लुणिया"), searchKey("लुनिया"));
  assert.equal(searchKey("कांतिलाल"), searchKey("कान्तिलाल"));
  assert.equal(searchKey("सुगनचंदजी"), searchKey("सुगनचंद"));
  assert.equal(searchKey("दीपिका"), searchKey("दिपिका"));
  const key = searchKey("सौ. निर्मलाबाई कचरदासजी चोरडिया");
  assert.ok(matchesSearch(key, "निर्मला चोरडीया"));
  assert.ok(!matchesSearch(key, "छाजेड"));
});

test("relations", () => {
  assert.equal(relationFromRaw("बायको"), "WIFE");
  assert.equal(relationFromRaw("सून"), "DAUGHTER_IN_LAW");
  assert.equal(relationFromRaw("बहू"), "DAUGHTER_IN_LAW");
  assert.equal(relationFromRaw("नातू"), "GRANDSON");
  assert.equal(relationFromRaw("पोती"), "GRANDDAUGHTER");
  assert.equal(relationFromRaw("मम्मी"), "MOTHER");
  assert.equal(relationFromRaw("भाभी"), "SISTER_IN_LAW");
  assert.equal(relationFromRaw("स्वतः"), "SELF");
  assert.equal(relationFromRaw("स्वयं"), "SELF");
  assert.equal(genderFromRelation("GRANDDAUGHTER"), "FEMALE");
});

test("age and eligibility", () => {
  const recorded = new Date("2026-09-01");
  const election = new Date("2026-11-22");
  // 17 in Sept: might be 18 by election day -> borderline
  const r17 = ageOn({ age: 17, ageRecordedOn: recorded, dob: null }, election);
  assert.deepEqual([r17.min, r17.max], [17, 18]);

  const fam = { panth: "STHANAKVASI", panthStatus: "CONFIRMED" };
  const opts = { asOfDate: election };
  assert.equal(checkVoter({ age: 45, ageRecordedOn: recorded, dob: null, status: "ACTIVE" }, fam, opts).eligible, true);
  assert.deepEqual(checkVoter({ age: 17, ageRecordedOn: recorded, dob: null, status: "ACTIVE" }, fam, opts).reasons, ["AGE_BORDERLINE"]);
  assert.deepEqual(checkVoter({ age: 15, ageRecordedOn: recorded, dob: null, status: "ACTIVE" }, fam, opts).reasons, ["UNDER_AGE"]);
  assert.deepEqual(
    checkVoter({ age: 45, ageRecordedOn: recorded, dob: null, status: "ACTIVE" }, { panth: "UNKNOWN", panthStatus: "TO_VERIFY" }, opts).reasons,
    ["PANTH_TO_VERIFY"],
  );
  assert.deepEqual(
    checkVoter({ age: 45, ageRecordedOn: recorded, dob: null, status: "ACTIVE" }, { panth: "DIGAMBAR", panthStatus: "CONFIRMED" }, opts).reasons,
    ["NOT_STHANAKVASI"],
  );
  // status rules off by default: deceased still listed ("add everyone for now")
  assert.equal(checkVoter({ age: 70, ageRecordedOn: recorded, dob: null, status: "DECEASED" }, fam, opts).eligible, true);
  assert.equal(checkVoter({ age: 70, ageRecordedOn: recorded, dob: null, status: "DECEASED" }, fam, { ...opts, applyStatusRules: true }).eligible, false);
  // exact DOB
  const dob = checkVoter({ age: null, ageRecordedOn: null, dob: new Date("2008-11-23"), status: "ACTIVE" }, fam, opts);
  assert.deepEqual(dob.reasons, ["UNDER_AGE"]);
});

import { rupeesInEnglish, rupeesInMarathi } from "./words";
test("amount in words", () => {
  assert.equal(rupeesInEnglish(5100), "Rupees Five Thousand One Hundred Only");
  assert.equal(rupeesInEnglish(125000), "Rupees One Lakh Twenty Five Thousand Only");
  assert.equal(rupeesInMarathi(100), "शंभर रुपये फक्त");
  assert.equal(rupeesInMarathi(5101), "पाच हजार एकशे एक रुपये फक्त");
  assert.equal(rupeesInMarathi(2500), "दोन हजार पाचशे रुपये फक्त");
  assert.equal(rupeesInMarathi(151000), "एक लाख एक्कावन्न हजार रुपये फक्त");
});

test("age as on cut-off date 01/10/2026", () => {
  const fam = { panth: "STHANAKVASI", panthStatus: "CONFIRMED" };
  const cutoff = new Date("2026-10-01");
  // DOB 2 Oct 2008: turns 18 one day after the cut-off -> not eligible
  assert.deepEqual(checkVoter({ age: null, ageRecordedOn: null, dob: new Date("2008-10-02"), status: "ACTIVE" }, fam, { asOfDate: cutoff }).reasons, ["UNDER_AGE"]);
  // DOB 1 Oct 2008: exactly 18 on the cut-off -> eligible
  assert.equal(checkVoter({ age: null, ageRecordedOn: null, dob: new Date("2008-10-01"), status: "ACTIVE" }, fam, { asOfDate: cutoff }).eligible, true);
});

import { toEnglishName, titleToEnglish } from "./translit";
import { latinFold } from "./normalize";
test("English spelling of names", () => {
  const cases: [string, string][] = [
    ["कांतिलालजी", "Kantilalji"], ["सुगनचंदजी", "Suganchandji"], ["निर्मलाबाई", "Nirmalabai"], ["चोरडिया", "Chordiya"],
    ["लुणिया", "Luniya"], ["दीपिका", "Deepika"], ["प्रविणकुमार", "Pravinkumar"], ["महावीर", "Mahavir"], ["राजेंद्र", "Rajendra"],
    ["ज्ञानेश्वर", "Dnyaneshwar"], ["रश्मी", "Rashmi"], ["शांतीलाल", "Shantilal"], ["पूजा", "Pooja"], ["संजय", "Sanjay"],
    ["चंपालाल", "Champalal"], ["Pratik", "Pratik"],
  ];
  for (const [dev, en] of cases) assert.equal(toEnglishName(dev), en, dev);
  assert.equal(titleToEnglish("सौ."), "Sau.");
});

test("English search tolerates spelling variation", () => {
  assert.equal(latinFold("Chordiya"), latinFold("Chordia"));
  assert.equal(latinFold("Deepika"), latinFold("Dipika"));
  assert.equal(latinFold("Oswal"), latinFold("Osval"));
  assert.equal(latinFold("Kantilalji"), latinFold("Kantilal"));
  const key = searchKey("Nirmalabai Kachardasji Chordiya");
  assert.ok(matchesSearch(key, "nirmala chordia"));
});

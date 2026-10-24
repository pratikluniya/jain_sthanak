import { test } from "node:test";
import assert from "node:assert/strict";
import { findDuplicates, type DupFamily, type DupMember } from "./duplicates";

const m = (id: string, firstName: string, middleName: string, surname: string, mobile = ""): DupMember => ({ id, firstName, middleName, surname, firstNameEn: "", surnameEn: "", mobile });
const f = (id: string, code: string, headName: string, address: string, members: DupMember[]): DupFamily => ({ id, code, headName, address, members });

test("finds the four kinds", () => {
  const fams = [
    f("1", "NR-1", "रमेश सुगनचंद बोथरा", "शांती नगर नाशिक रोड", [m("a", "रमेश", "सुगनचंद", "बोथरा", "9800000001"), m("b", "सुनीता", "रमेश", "बोथरा")]),
    f("2", "NR-2", "रमेश सुगनचंदजी बोथरा", "शांती नगर, नाशिकरोड", [m("c", "रमेश", "सुगनचंद", "बोथरा", "9800000001")]),
    f("3", "NR-3", "महावीर कांतिलाल सुराणा", "जेल रोड", [m("d", "महावीर", "कांतिलाल", "सुराणा", "9800000003"), m("e", "प्रिया", "", "सुराणा"), m("g", "प्रिया", "महावीर", "सुराणा")]),
    f("4", "NR-4", "संजय रतनलाल चोरडिया", "बिटको", [m("h", "संजय", "रतनलाल", "चोरडिया", "9800000003")]),
  ];
  const r = findDuplicates(fams);
  const kinds = (k: string) => r.filter((p) => p.kind === k).map((p) => [p.a.memberId ?? p.a.code, p.b.memberId ?? p.b.code].sort().join("-"));
  assert.deepEqual(kinds("SAME_FAMILY_TWICE"), ["NR-1-NR-2"]);
  assert.deepEqual(kinds("SAME_PERSON_2_FAMILIES"), ["a-c"]);
  assert.deepEqual(kinds("SAME_PERSON_IN_FAMILY"), ["e-g"]);
  assert.deepEqual(kinds("SHARED_MOBILE"), ["d-h"], "a-c share a mobile but are already a same-person pair");
});

// Smart merge of a duplicate form into an existing family (decided 23 Oct 2026):
// - every form row is matched to an existing member (or is a new member);
// - a matched member only gets the fields that are BLANK in the app; values already saved are never
//   overwritten, differences are shown to the volunteer as warnings;
// - an Aadhaar is attached only to a member who has none yet;
// - only rows that match nobody are added as new members.
// Pure functions: used on the check screen (preview) and in the save action (the real merge).
import { normalizeBloodGroup, normalizeMobile, parseAge, searchKey } from "./normalize";

export interface ExistingMember {
  id: string;
  name: string; // for display
  firstName: string;
  middleName: string;
  surname: string;
  firstNameEn: string;
  middleNameEn: string;
  surnameEn: string;
  mobile: string;
  age: number | null; // today's age (from DOB or the form age grown by the years)
  dob: string | null; // YYYY-MM-DD
  education: string;
  occupation: string;
  bloodGroup: string;
  hasKyc: boolean;
}

export interface FormRow {
  key: string;
  firstName: string;
  middleName: string;
  surname: string;
  firstNameEn: string;
  middleNameEn: string;
  surnameEn: string;
  mobile: string;
  age: string;
  dob: string;
  education: string;
  occupation: string;
  bloodGroup: string;
}

export type MergeField = "mobile" | "age" | "dob" | "education" | "occupation" | "bloodGroup" | "englishName";

export interface MergeDiff {
  fill: MergeField[]; // blank in the app, the form has a value: will be filled
  conflicts: { field: MergeField; saved: string; form: string }[]; // both have a value and they differ: app value kept
}

const k = (s: string) => searchKey(s ?? "").replace(/\s+/g, "");
const mob = (s: string) => normalizeMobile(s ?? "").value;

/** How likely a form row is the same person as an existing member (0 = not at all). */
export function scorePair(r: FormRow, m: ExistingMember): number {
  const firstEq = (!!k(r.firstName) && k(r.firstName) === k(m.firstName)) || (!!k(r.firstNameEn) && k(r.firstNameEn) === k(m.firstNameEn));
  const mobileEq = mob(r.mobile).length === 10 && mob(r.mobile) === mob(m.mobile);
  if (!firstEq && !mobileEq) return 0;
  let s = 0;
  if (firstEq) s += 4;
  if (mobileEq) s += 3;
  if ((k(r.surname) && k(r.surname) === k(m.surname)) || (k(r.surnameEn) && k(r.surnameEn) === k(m.surnameEn))) s += 1;
  if ((k(r.middleName) && k(r.middleName) === k(m.middleName)) || (k(r.middleNameEn) && k(r.middleNameEn) === k(m.middleNameEn))) s += 1;
  return s;
}

/** Best one-to-one matching: form row key -> existing member id ("" = new member). */
export function guessMatches(rows: FormRow[], existing: ExistingMember[]): Record<string, string> {
  const pairs: { key: string; id: string; s: number }[] = [];
  for (const r of rows) for (const m of existing) {
    const s = scorePair(r, m);
    if (s >= 4) pairs.push({ key: r.key, id: m.id, s });
  }
  pairs.sort((a, b) => b.s - a.s);
  const out: Record<string, string> = Object.fromEntries(rows.map((r) => [r.key, ""]));
  const usedRow = new Set<string>();
  const usedMember = new Set<string>();
  for (const p of pairs) {
    if (usedRow.has(p.key) || usedMember.has(p.id)) continue;
    out[p.key] = p.id;
    usedRow.add(p.key);
    usedMember.add(p.id);
  }
  return out;
}

const same = (a: string, b: string) => a.trim().toLowerCase().replace(/\s+/g, " ") === b.trim().toLowerCase().replace(/\s+/g, " ");

/** What merging this row into this member would change, and where the two disagree. */
export function mergeDiff(r: FormRow, m: ExistingMember): MergeDiff {
  const d: MergeDiff = { fill: [], conflicts: [] };
  const text = (field: MergeField, saved: string, form: string, eq: (a: string, b: string) => boolean = same) => {
    if (!form.trim()) return;
    if (!saved.trim()) d.fill.push(field);
    else if (!eq(saved, form)) d.conflicts.push({ field, saved, form });
  };
  text("mobile", m.mobile, mob(r.mobile), (a, b) => mob(a) === mob(b));
  text("bloodGroup", m.bloodGroup, normalizeBloodGroup(r.bloodGroup));
  text("education", m.education, r.education);
  text("occupation", m.occupation, r.occupation);
  if (/^\d{4}-\d{2}-\d{2}$/.test(r.dob)) text("dob", m.dob ?? "", r.dob);
  const formAge = parseAge(r.age);
  if (formAge !== null && !r.dob && !m.dob) {
    if (m.age === null) d.fill.push("age");
    else if (Math.abs(m.age - formAge) > 1) d.conflicts.push({ field: "age", saved: String(m.age), form: String(formAge) });
  }
  if (!m.firstNameEn.trim() && r.firstNameEn.trim()) d.fill.push("englishName");
  return d;
}

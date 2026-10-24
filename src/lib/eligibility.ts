// Voter eligibility rules (confirmed by the Sangh, 27 Sep 2026):
//   1. Age 18 or more as on the age cut-off date (Settings; default 01/10/2026)
//   2. Family panth confirmed as Sthanakvasi or Terapanth (decided 24 Oct 2026; 9-24 Oct any panth except
//      Digambar; before that only Sthanakvasi). Blank or unconfirmed panth = "to verify".
//      Per-family switch (24 Oct 2026): INCLUDE skips this panth rule, EXCLUDE takes the family off the list.
//   3. A member marked deceased, or who moved out of the area (alone or with the family),
//      is never a voter (decided 6-7 Oct 2026).
//   4. Someone who joined through an individual application (सभासद अर्ज) counts only when the
//      application is APPROVED (decided 8 Oct 2026). Members from census forms have no application.
// The other membership cancellation rules printed on the form (moved out,
// married daughters, inactive family) are applied only when the
// `applyStatusRules` setting is on.

export const VOTING_AGE = 18;
export const VOTING_PANTHS = ["STHANAKVASI", "TERAPANTH"];

export interface AgeInput {
  age: number | null;
  ageRecordedOn: Date | null;
  dob: Date | null;
}

export interface AgeRange {
  min: number | null; // youngest they can be on the target date
  max: number | null; // oldest they can be on the target date
  exact: boolean;
}

function fullYearsBetween(from: Date, to: Date): number {
  let y = to.getFullYear() - from.getFullYear();
  const m = to.getMonth() - from.getMonth();
  if (m < 0 || (m === 0 && to.getDate() < from.getDate())) y--;
  return y;
}

/**
 * Age on a given date. With a DOB it is exact. With only "age N as of date R"
 * the true age is N + (whole years since R), or one more if a birthday fell in
 * between, so we return a range.
 */
export function ageOn(m: AgeInput, target: Date): AgeRange {
  if (m.dob) {
    const a = fullYearsBetween(m.dob, target);
    return { min: a, max: a, exact: true };
  }
  if (m.age === null || m.age === undefined) return { min: null, max: null, exact: false };
  const recorded = m.ageRecordedOn ?? target;
  const yrs = Math.max(0, fullYearsBetween(recorded, target));
  const sameDay = recorded.toDateString() === target.toDateString();
  return { min: m.age + yrs, max: sameDay ? m.age + yrs : m.age + yrs + 1, exact: sameDay };
}

/**
 * Age today, for screens and downloads (decided 23 Oct 2026). With a DOB it is exact; with only
 * "age N as of date R" it grows by the whole years since R (the lower number while a birthday
 * may or may not have passed). Nothing is stored, so it never goes stale.
 */
export function currentAge(m: AgeInput, today: Date = new Date()): number | null {
  return ageOn(m, today).min;
}

/** Whole years from a YYYY-MM-DD birth date to today, or "" when the date is missing or invalid. */
export function ageFromDobString(dob: string, today: Date = new Date()): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return "";
  const d = new Date(`${dob}T00:00:00`);
  if (isNaN(d.getTime()) || d > today) return "";
  return String(fullYearsBetween(d, today));
}

export type Reason =
  | "UNDER_AGE"
  | "AGE_UNKNOWN"
  | "AGE_BORDERLINE" // may or may not be 18 on election day: needs DOB
  | "PANTH_NOT_ELIGIBLE" // Mandirmargi or Digambar (only Sthanakvasi and Terapanth vote)
  | "EXCLUDED_FAMILY" // family switched off the voter list by Admin / Operator
  | "PANTH_TO_VERIFY"
  | "DECEASED"
  | "MOVED_OUT"
  | "STATUS_INACTIVE"
  | "NOT_APPROVED"; // individual application pending or rejected

export interface EligibilityResult {
  eligible: boolean;
  reasons: Reason[];
  age: AgeRange;
}

export interface EligibilityOptions {
  asOfDate: Date; // age is calculated as on this date
  applyStatusRules?: boolean;
}

export function checkVoter(
  member: AgeInput & { status: string; application?: { decision: string } | null },
  family: { panth: string; panthStatus: string; status?: string; voterOverride?: string },
  opts: EligibilityOptions,
): EligibilityResult {
  const reasons: Reason[] = [];
  const age = ageOn(member, opts.asOfDate);

  if (age.min === null) reasons.push("AGE_UNKNOWN");
  else if (age.min >= VOTING_AGE) {
    /* ok */
  } else if (age.max !== null && age.max >= VOTING_AGE) reasons.push("AGE_BORDERLINE");
  else reasons.push("UNDER_AGE");

  if (family.voterOverride === "EXCLUDE") reasons.push("EXCLUDED_FAMILY");
  else if (family.voterOverride === "INCLUDE") {
    /* panth rule skipped for this family */
  } else if (family.panthStatus !== "CONFIRMED") reasons.push("PANTH_TO_VERIFY");
  else if (!VOTING_PANTHS.includes(family.panth)) reasons.push("PANTH_NOT_ELIGIBLE");

  if (member.status === "DECEASED") reasons.push("DECEASED");
  else if (member.status === "MOVED_OUT" || family.status === "MOVED_OUT") reasons.push("MOVED_OUT");
  else if (opts.applyStatusRules) {
    if (member.status !== "ACTIVE" || (family.status && family.status !== "ACTIVE")) reasons.push("STATUS_INACTIVE");
  }
  if (member.application && member.application.decision !== "APPROVED") reasons.push("NOT_APPROVED");

  return { eligible: reasons.length === 0, reasons, age };
}

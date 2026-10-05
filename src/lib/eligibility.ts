// Voter eligibility rules (confirmed by the Sangh, 27 Sep 2026):
//   1. Age 18 or more as on the age cut-off date (Settings; default 01/10/2026)
//   2. Family panth = Sthanakvasi, and confirmed (blank panth = "to verify")
//   3. A member marked deceased is never a voter (decided 6 Oct 2026).
// The other membership cancellation rules printed on the form (moved out,
// married daughters, inactive family) are applied only when the
// `applyStatusRules` setting is on.

export const VOTING_AGE = 18;

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

export type Reason =
  | "UNDER_AGE"
  | "AGE_UNKNOWN"
  | "AGE_BORDERLINE" // may or may not be 18 on election day: needs DOB
  | "NOT_STHANAKVASI"
  | "PANTH_TO_VERIFY"
  | "DECEASED"
  | "STATUS_INACTIVE";

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
  member: AgeInput & { status: string },
  family: { panth: string; panthStatus: string; status?: string },
  opts: EligibilityOptions,
): EligibilityResult {
  const reasons: Reason[] = [];
  const age = ageOn(member, opts.asOfDate);

  if (age.min === null) reasons.push("AGE_UNKNOWN");
  else if (age.min >= VOTING_AGE) {
    /* ok */
  } else if (age.max !== null && age.max >= VOTING_AGE) reasons.push("AGE_BORDERLINE");
  else reasons.push("UNDER_AGE");

  if (family.panthStatus !== "CONFIRMED") reasons.push("PANTH_TO_VERIFY");
  else if (family.panth !== "STHANAKVASI") reasons.push("NOT_STHANAKVASI");

  if (member.status === "DECEASED") reasons.push("DECEASED");
  else if (opts.applyStatusRules) {
    if (member.status !== "ACTIVE" || (family.status && family.status !== "ACTIVE")) reasons.push("STATUS_INACTIVE");
  }

  return { eligible: reasons.length === 0, reasons, age };
}

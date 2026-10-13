// Missing-data flags (decided 11 Oct 2026, changed 12 Oct 2026). Only living members count: status ACTIVE
// (deceased, married-out and moved-out members, and deleted ones, are never flagged).
//  - noaadhaar: no Aadhaar image, for members 18 or older (or whose age is unknown). The front alone is
//               enough and an uploaded Aadhaar is never "pending": there is no separate KYC approval.
//  - nophoto:   no photo.
//  - nomobile:  no mobile number.
//  - nodob:     no date of birth (even when an age is written).
//  - noage:     neither age nor date of birth.
import { ageOn } from "./eligibility";

export const GAPS = ["noaadhaar", "nophoto", "nomobile", "nodob", "noage"] as const;
export type Gap = (typeof GAPS)[number];

export const asGap = (v: string | null | undefined): Gap | null => (GAPS.includes(v as Gap) ? (v as Gap) : null);

export interface GapMember {
  status: string;
  kycFileKey: string | null;
  kycDocType: string | null;
  aadhaarBackKey: string | null;
  photoKey: string | null;
  mobile: string;
  age: number | null;
  dob: Date | null;
  ageRecordedOn?: Date | null;
}

/** An Aadhaar image is on file: the front (when the single KYC file is an Aadhaar) or the back. */
export function hasAadhaarImage(m: GapMember): boolean {
  if (m.aadhaarBackKey) return true;
  return !!m.kycFileKey && (!m.kycDocType || m.kycDocType === "AADHAAR");
}

/** Aadhaar is expected from members who are 18 or older today, and from those whose age is not known. */
export function needsAadhaar(m: GapMember, today = new Date()): boolean {
  const a = ageOn({ age: m.age, dob: m.dob, ageRecordedOn: m.ageRecordedOn ?? null }, today);
  return a.max === null || a.max >= 18;
}

export function memberGaps(m: GapMember, today = new Date()): Gap[] {
  if (m.status !== "ACTIVE") return [];
  const out: Gap[] = [];
  if (!hasAadhaarImage(m) && needsAadhaar(m, today)) out.push("noaadhaar");
  if (!m.photoKey) out.push("nophoto");
  if (!m.mobile.trim()) out.push("nomobile");
  if (!m.dob) out.push("nodob");
  if (m.age === null && !m.dob) out.push("noage");
  return out;
}

export const hasGap = (m: GapMember, g: Gap) => memberGaps(m).includes(g);

/** Family summary: how many living members of 18+ still have no Aadhaar uploaded (0 = all uploaded). */
export function aadhaarPendingCount(members: GapMember[], today = new Date()): number {
  return members.filter((m) => memberGaps(m, today).includes("noaadhaar")).length;
}

// Missing-data lists (decided 11 Oct 2026). Only living members count: status ACTIVE
// (deceased, married-out and moved-out members, and deleted ones, are never flagged).
//  - noaadhaar: no Aadhaar image at all. The front alone is enough; a typed number without an image is not.
//  - nophoto:   no passport photo.
//  - noage:     both age and date of birth are empty.

export const GAPS = ["noaadhaar", "nophoto", "noage"] as const;
export type Gap = (typeof GAPS)[number];

export const asGap = (v: string | null | undefined): Gap | null => (GAPS.includes(v as Gap) ? (v as Gap) : null);

interface GapMember {
  status: string;
  kycFileKey: string | null;
  kycDocType: string | null;
  aadhaarBackKey: string | null;
  photoKey: string | null;
  age: number | null;
  dob: Date | null;
}

/** An Aadhaar image is on file: the front (when the single KYC file is an Aadhaar) or the back. */
export function hasAadhaarImage(m: GapMember): boolean {
  if (m.aadhaarBackKey) return true;
  return !!m.kycFileKey && (!m.kycDocType || m.kycDocType === "AADHAAR");
}

export function memberGaps(m: GapMember): Gap[] {
  if (m.status !== "ACTIVE") return [];
  const out: Gap[] = [];
  if (!hasAadhaarImage(m)) out.push("noaadhaar");
  if (!m.photoKey) out.push("nophoto");
  if (m.age === null && !m.dob) out.push("noage");
  return out;
}

export const hasGap = (m: GapMember, g: Gap) => memberGaps(m).includes(g);

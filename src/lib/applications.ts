// Saving an individual membership application (सभासद अर्ज) after a volunteer checked it (decided 8 Oct 2026):
// the applicant joins an existing family (e.g. a newly married wife or daughter-in-law) with a relation,
// or starts a new family whose panth is "to verify". The application details are kept with the member.
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { LIVE } from "./softDelete";
import { nextFamilyCode } from "./counters";
import { inferHeadGender, prepareMember } from "./members";
import { fullName, normalizeMobile, searchKey } from "./normalize";
import { DOC_CODES, parseFormDate, parseRupees } from "./applicationForm";
import { getFile, putFile } from "./storage";

type Tx = Prisma.TransactionClient;

export interface FamilySuggestion {
  id: string;
  code: string;
  headName: string;
  address: string;
  /** family member whose first name matches the applicant's middle name (husband / father-in-law) */
  matchedMember: string;
  relation: string;
  reasons: string[];
}

const words = (s: string) => searchKey(s).split(" ").filter((w) => w.length > 1);

/** Relation of the applicant, when her husband (middle name) is this member of the family. */
function relationVia(memberRelation: string, applicantGender: string): string {
  if (applicantGender === "MALE") return "OTHER";
  if (memberRelation === "SELF") return "WIFE";
  if (memberRelation === "SON") return "DAUGHTER_IN_LAW";
  if (memberRelation === "GRANDSON") return "GRANDDAUGHTER_IN_LAW";
  if (memberRelation === "BROTHER") return "SISTER_IN_LAW";
  return "OTHER";
}

/**
 * Families the applicant may belong to, best first. Score: same surname +3, husband's/father's first name
 * found in the family +4, shared mobile +5, matching address words +1 each (max 3). Shown if 3 or more.
 */
export async function suggestFamilies(a: { surname: string; middleName: string; gender: string; mobile: string; homeAddress: string }): Promise<FamilySuggestion[]> {
  const sur = words(a.surname)[0];
  const mid = words(a.middleName)[0];
  const mobile = normalizeMobile(a.mobile).value;
  const addr = new Set(words(a.homeAddress).filter((w) => w.length > 2));
  const families = await prisma.family.findMany({
    where: { ...LIVE, status: { not: "MOVED_OUT" } },
    include: { members: { where: { ...LIVE, status: { notIn: ["MOVED_OUT", "DECEASED"] } } } },
  });
  const out: (FamilySuggestion & { score: number })[] = [];
  for (const f of families) {
    let score = 0;
    const reasons: string[] = [];
    if (sur && (f.members.some((m) => words(m.surname)[0] === sur) || words(f.headName).includes(sur))) {
      score += 3;
      reasons.push("surname");
    }
    const husband = mid ? f.members.find((m) => m.gender !== "FEMALE" && words(m.firstName)[0] === mid) : undefined;
    if (husband) {
      score += 4;
      reasons.push("husband/father");
    }
    if (mobile.length === 10 && f.members.some((m) => m.mobile === mobile)) {
      score += 5;
      reasons.push("mobile");
    }
    const hits = Math.min(3, words(f.address).filter((w) => addr.has(w)).length);
    if (hits >= 2) reasons.push("address");
    score += hits;
    if (score >= 3) {
      out.push({
        id: f.id,
        code: f.code,
        headName: f.headName,
        address: f.address,
        matchedMember: husband ? fullName(husband, false) : "",
        relation: husband ? relationVia(husband.relation, a.gender) : "OTHER",
        reasons,
        score,
      });
    }
  }
  return out
    .sort((x, y) => y.score - x.score)
    .slice(0, 5)
    .map(({ score: _s, ...r }) => r);
}

export interface ApplicationFields {
  appNo: string;
  appDate: string;
  homeAddress: string;
  businessAddress: string;
  email: string;
  landline: string;
  feeEntry: string;
  feeAnnual: string;
  feeLifetime: string;
  feeTotal: string;
  receiptNo: string;
  receiptDate: string;
  proposerName: string;
  proposerAddress: string;
  proposerMobile: string;
  proposerLandline: string;
  seconderName: string;
  seconderAddress: string;
  seconderMobile: string;
  seconderLandline: string;
  decision: string;
  meetingDate: string;
  rejectReasons: string;
  docs: string[];
  notes: string;
}

const t = (s: string | undefined) => (s ?? "").trim().replace(/\s+/g, " ").slice(0, 500);
const date = (s: string) => {
  const d = parseFormDate(s);
  return d ? new Date(d) : null;
};

/** Typed / read values -> database fields (dates and rupees parsed, unknown documents dropped). */
export function applicationData(f: ApplicationFields) {
  return {
    appNo: t(f.appNo),
    appDate: date(f.appDate),
    homeAddress: t(f.homeAddress),
    businessAddress: t(f.businessAddress),
    email: t(f.email).toLowerCase(),
    landline: t(f.landline),
    feeEntry: parseRupees(f.feeEntry),
    feeAnnual: parseRupees(f.feeAnnual),
    feeLifetime: parseRupees(f.feeLifetime),
    feeTotal: parseRupees(f.feeTotal),
    receiptNo: t(f.receiptNo),
    receiptDate: date(f.receiptDate),
    proposerName: t(f.proposerName),
    proposerAddress: t(f.proposerAddress),
    proposerMobile: normalizeMobile(f.proposerMobile).value,
    proposerLandline: t(f.proposerLandline),
    seconderName: t(f.seconderName),
    seconderAddress: t(f.seconderAddress),
    seconderMobile: normalizeMobile(f.seconderMobile).value,
    seconderLandline: t(f.seconderLandline),
    decision: (["APPROVED", "PENDING", "REJECTED"].includes(f.decision) ? f.decision : "APPROVED") as "APPROVED" | "PENDING" | "REJECTED",
    meetingDate: date(f.meetingDate),
    rejectReasons: t(f.rejectReasons),
    docs: f.docs.filter((d) => (DOC_CODES as readonly string[]).includes(d)),
    notes: t(f.notes),
  };
}

export interface ApplicantInput {
  title: string;
  firstName: string;
  middleName: string;
  surname: string;
  firstNameEn: string;
  middleNameEn: string;
  surnameEn: string;
  nameRaw: string;
  gender: string;
  dob: string;
  age: string;
  mobile: string;
  occupation: string;
  education: string;
  bloodGroup: string;
}

export interface SaveApplicationInput {
  uploadId: string;
  mode: "existing" | "new";
  familyCode?: string;
  relation: string;
  applicant: ApplicantInput;
  application: ApplicationFields;
  /** photo picked on the check screen (wins over the one cropped at import) */
  photo?: { data: Buffer; type: string } | null;
  by: { uid: string; name: string };
}

export type SaveApplicationResult = { ok: true; familyId: string; memberId: string } | { ok: false; error: "alreadySaved" | "familyNotFound" | "nameRequired" | "relationSelf" };

export async function saveApplication(input: SaveApplicationInput): Promise<SaveApplicationResult> {
  const up = await prisma.formUpload.findUniqueOrThrow({ where: { id: input.uploadId } });
  if (up.status === "VERIFIED") return { ok: false, error: "alreadySaved" };
  const a = input.applicant;
  if (!a.firstName.trim()) return { ok: false, error: "nameRequired" };
  if (input.mode === "existing" && input.relation === "SELF") return { ok: false, error: "relationSelf" };

  let existing = null;
  if (input.mode === "existing") {
    existing = await prisma.family.findFirst({ where: { code: (input.familyCode ?? "").trim().toUpperCase(), ...LIVE, status: { not: "MOVED_OUT" } } });
    if (!existing) return { ok: false, error: "familyNotFound" };
  }
  const app = applicationData(input.application);
  const recordedOn = app.appDate ?? up.createdAt;
  const dob = parseFormDate(a.dob);

  // passport photo: chosen now, else the one cropped from the form at import
  let photoKey: string | null = null;
  const extractedPhoto = (up.extracted as { photoKey?: string } | null)?.photoKey;
  const photoBytes = input.photo ?? (extractedPhoto ? { data: await getFile("forms", extractedPhoto), type: "image/jpeg" } : null);
  if (photoBytes) {
    const ext = photoBytes.type === "image/png" ? "png" : photoBytes.type === "image/webp" ? "webp" : "jpg";
    photoKey = `application/${up.id}-photo-${Date.now()}.${ext}`;
    await putFile("photos", photoKey, photoBytes.data, photoBytes.type || "image/jpeg");
  }

  const res = await prisma.$transaction(async (tx: Tx) => {
    let fam = existing;
    if (!fam) {
      fam = await tx.family.create({
        data: {
          code: await nextFamilyCode(tx),
          headName: fullName(a, false),
          headNameEn: [a.firstNameEn, a.middleNameEn, a.surnameEn].filter(Boolean).join(" "),
          address: app.homeAddress,
          panth: "UNKNOWN",
          panthStatus: "TO_VERIFY", // the form has no panth (decided 8 Oct 2026)
          formDate: recordedOn,
          notes: "सभासद अर्जाद्वारे नवीन कुटुंब",
        },
      });
    }
    const count = await tx.member.count({ where: { familyId: fam.id } });
    const data = prepareMember(
      {
        ...a,
        dob: dob || null,
        relation: input.mode === "new" ? "SELF" : input.relation,
        isHead: input.mode === "new",
        serial: count + 1,
      },
      fam.code,
      recordedOn,
    );
    data.nameRaw = a.nameRaw.trim() || data.nameRaw;
    const member = await tx.member.create({ data: { ...data, familyId: fam.id, photoKey } });
    await tx.membershipApplication.create({ data: { ...app, memberId: member.id, uploadId: up.id, createdById: input.by.uid } });
    await inferHeadGender(fam.id, tx);
    await tx.formUpload.update({ where: { id: up.id }, data: { status: "VERIFIED", familyId: fam.id, verifiedBy: input.by.name } });
    return { familyId: fam.id, memberId: member.id };
  });
  return { ok: true, ...res };
}

/** Correcting the application details later (Edit on the family page). */
export async function updateApplication(memberId: string, f: ApplicationFields) {
  return prisma.membershipApplication.update({ where: { memberId }, data: applicationData(f) });
}

/** Reads the application fields from a submitted form (same names on the check screen and the edit page). */
export function applicationFromForm(fd: FormData): ApplicationFields {
  const s = (k: string) => String(fd.get(k) ?? "");
  return {
    appNo: s("appNo"),
    appDate: s("appDate"),
    homeAddress: s("homeAddress"),
    businessAddress: s("businessAddress"),
    email: s("email"),
    landline: s("landline"),
    feeEntry: s("feeEntry"),
    feeAnnual: s("feeAnnual"),
    feeLifetime: s("feeLifetime"),
    feeTotal: s("feeTotal"),
    receiptNo: s("receiptNo"),
    receiptDate: s("receiptDate"),
    proposerName: s("proposerName"),
    proposerAddress: s("proposerAddress"),
    proposerMobile: s("proposerMobile"),
    proposerLandline: s("proposerLandline"),
    seconderName: s("seconderName"),
    seconderAddress: s("seconderAddress"),
    seconderMobile: s("seconderMobile"),
    seconderLandline: s("seconderLandline"),
    decision: s("decision"),
    meetingDate: s("meetingDate"),
    rejectReasons: s("rejectReasons"),
    docs: fd.getAll("docs").map(String),
    notes: s("notes"),
  };
}

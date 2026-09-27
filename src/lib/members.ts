import type { Family, Member, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { fullName, normalizeBloodGroup, normalizeMobile, parseAge, searchKey, splitName } from "./normalize";
import { genderFromRelation, genderFromTitle, relationFromRaw } from "./relations";
import { checkVoter, type EligibilityResult } from "./eligibility";
import { effectiveElectionDate, getSettings } from "./settings";

export const collator = new Intl.Collator("mr", { sensitivity: "base", numeric: true });

export function memberFullName(m: Pick<Member, "title" | "firstName" | "middleName" | "surname">, withTitle = true) {
  return fullName(m, withTitle);
}

export function computeSearchKey(m: { firstName: string; middleName?: string; surname?: string; mobile?: string }, familyCode?: string) {
  return [searchKey([m.firstName, m.middleName, m.surname].filter(Boolean).join(" ")), m.mobile ?? "", (familyCode ?? "").toLowerCase()]
    .filter(Boolean)
    .join(" ");
}

/** Input as typed by a volunteer or read from a form. */
export interface MemberInput {
  nameRaw?: string;
  title?: string;
  firstName?: string;
  middleName?: string;
  surname?: string;
  age?: string | number | null;
  dob?: string | null;
  relationRaw?: string;
  relation?: string;
  gender?: string;
  education?: string;
  occupation?: string;
  mobile?: string;
  bloodGroup?: string;
  status?: string;
  isHead?: boolean;
  serial?: number;
}

/** Turn raw input into clean DB fields (name split, digits, relation, gender, search key). */
export function prepareMember(input: MemberInput, familyCode: string, ageRecordedOn: Date) {
  const parts =
    input.firstName !== undefined
      ? { title: input.title ?? "", firstName: input.firstName ?? "", middleName: input.middleName ?? "", surname: input.surname ?? "", deceasedHint: false }
      : splitName(input.nameRaw ?? "");
  const relation = input.relation && input.relation !== "" ? input.relation : relationFromRaw(input.relationRaw ?? "");
  let gender = (input.gender as "MALE" | "FEMALE" | "UNKNOWN") || "UNKNOWN";
  if (gender === "UNKNOWN") gender = genderFromRelation(relation);
  if (gender === "UNKNOWN") gender = genderFromTitle(parts.title);
  const mobile = normalizeMobile(input.mobile ?? "").value;
  const age = parseAge(input.age ?? null);
  const status = (input.status as Member["status"]) || (parts.deceasedHint ? "DECEASED" : "ACTIVE");
  return {
    title: parts.title,
    firstName: parts.firstName,
    middleName: parts.middleName,
    surname: parts.surname,
    nameRaw: input.nameRaw ?? fullName(parts),
    searchKey: computeSearchKey({ ...parts, mobile }, familyCode),
    isHead: !!input.isHead || relation === "SELF",
    relation,
    relationRaw: input.relationRaw ?? "",
    gender,
    age,
    ageRecordedOn: age !== null ? ageRecordedOn : null,
    dob: input.dob ? new Date(input.dob) : null,
    education: (input.education ?? "").trim(),
    occupation: (input.occupation ?? "").trim(),
    mobile,
    bloodGroup: normalizeBloodGroup(input.bloodGroup ?? ""),
    status,
    serial: input.serial ?? 0,
  } satisfies Partial<Prisma.MemberUncheckedCreateInput>;
}

export type FamilyWithMembers = Family & { members: Member[] };

export interface VoterRow {
  member: Member;
  family: Family;
  result: EligibilityResult;
}

/** Evaluate every member against the voter rules. */
export async function evaluateAll(): Promise<{ rows: VoterRow[]; electionDate: Date; electionDateSet: boolean; applyStatusRules: boolean }> {
  const settings = await getSettings();
  const electionDate = effectiveElectionDate(settings);
  const families = await prisma.family.findMany({ include: { members: true } });
  const rows: VoterRow[] = [];
  for (const f of families) {
    for (const m of f.members) {
      rows.push({ member: m, family: f, result: checkVoter(m, f, { electionDate, applyStatusRules: settings.applyStatusRules }) });
    }
  }
  return { rows, electionDate, electionDateSet: !!settings.electionDate, applyStatusRules: settings.applyStatusRules };
}

/** Voter list order: surname, then first name, then middle name (Marathi alphabetical). */
export function sortBySurname<T extends { member: Member }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      collator.compare(a.member.surname, b.member.surname) ||
      collator.compare(a.member.firstName, b.member.firstName) ||
      collator.compare(a.member.middleName, b.member.middleName),
  );
}

export function displayAge(r: EligibilityResult): string {
  if (r.age.min === null) return "";
  return r.age.min === r.age.max ? String(r.age.min) : `${r.age.min}-${r.age.max}`;
}

/**
 * The head's relation is "self", which says nothing about gender. If the family has a
 * wife (पत्नी/बायको) the head is male; if it has a husband, female.
 */
export async function inferHeadGender(familyId: string, tx: Pick<typeof prisma, "member"> = prisma) {
  const members = await tx.member.findMany({ where: { familyId }, select: { id: true, relation: true, gender: true } });
  const head = members.find((m) => m.relation === "SELF" && m.gender === "UNKNOWN");
  if (!head) return;
  const hasWife = members.some((m) => m.relation === "WIFE");
  const hasHusband = members.some((m) => m.relation === "HUSBAND");
  if (hasWife !== hasHusband) await tx.member.update({ where: { id: head.id }, data: { gender: hasWife ? "MALE" : "FEMALE" } });
}

// The lists shown on screen, built in one place so the Download of a tab gives exactly the rows on screen
// (decided 7 Nov 2026: "download what I see" on Members, Voters, Families, Donations and Duplicates).
import type { DonationKind, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { LIVE } from "./softDelete";
import { MISSING_DOD_WHERE } from "./deceased";
import { hasGap, type Gap } from "./gaps";
import { matchesSearch, searchKey } from "./normalize";
import { collator, sortBySurname, VOTER_FAMILY_SELECT, VOTER_MEMBER_SELECT, type VoterRow } from "./members";
import { DUE_FAMILY } from "./donations";
import type { DupFamily } from "./duplicates";

// ---------- Members ----------
export type MemberMode = "normal" | "nodod" | "moved" | "deleted";

export const MEMBER_LIST_SELECT = {
  ...VOTER_MEMBER_SELECT,
  deletedAt: true,
  family: { select: { ...VOTER_FAMILY_SELECT, deletedAt: true } },
} satisfies Prisma.MemberSelect;
export type ListMember = Prisma.MemberGetPayload<{ select: typeof MEMBER_LIST_SELECT }>;

function memberWhere(mode: MemberMode): Prisma.MemberWhereInput {
  if (mode === "nodod") return MISSING_DOD_WHERE;
  if (mode === "deleted") return { deletedAt: { not: null } };
  if (mode === "moved") return { deletedAt: null, family: { deletedAt: null }, OR: [{ status: "MOVED_OUT" }, { family: { status: "MOVED_OUT" } }] };
  return { deletedAt: null, status: { not: "MOVED_OUT" }, family: { deletedAt: null, status: { not: "MOVED_OUT" } } };
}

export function loadMembers(mode: MemberMode): Promise<ListMember[]> {
  return prisma.member.findMany({ where: memberWhere(mode), select: MEMBER_LIST_SELECT });
}

export interface MemberFilters {
  q?: string;
  blood?: string;
  gap?: Gap | null;
}

/** Search, blood group and missing-data tab, in surname order (as on the Members screen). */
export function filterMembers<T extends ListMember>(all: T[], f: MemberFilters): T[] {
  const q = (f.q ?? "").trim();
  return sortBySurname(
    all.filter((m) => (!q || matchesSearch(m.searchKey, q)) && (!f.blood || m.bloodGroup === f.blood) && (!f.gap || hasGap(m, f.gap))).map((m) => ({ member: m })),
  ).map((r) => r.member);
}

// ---------- Families ----------
export interface FamilyMode {
  deleted?: boolean;
  moved?: boolean;
  toVerify?: boolean;
}

export const FAMILY_LIST_MEMBER_SELECT = {
  searchKey: true, mobile: true, status: true, kycFileKey: true, kycDocType: true, aadhaarBackKey: true, photoKey: true,
  age: true, dob: true, ageRecordedOn: true, isHead: true, serial: true,
} satisfies Prisma.MemberSelect;

export function loadFamilies(mode: FamilyMode) {
  return prisma.family.findMany({
    where: {
      deletedAt: mode.deleted ? { not: null } : null,
      ...(mode.deleted ? {} : { status: mode.moved ? ("MOVED_OUT" as const) : { not: "MOVED_OUT" as const } }),
      ...(mode.toVerify ? { panthStatus: "TO_VERIFY" as const } : {}),
    },
    include: {
      members: {
        where: mode.deleted ? { deletedAt: { not: null } } : mode.moved ? { deletedAt: null } : { deletedAt: null, status: { not: "MOVED_OUT" } },
        select: FAMILY_LIST_MEMBER_SELECT,
      },
    },
  });
}
export type ListFamily = Awaited<ReturnType<typeof loadFamilies>>[number];

/** Search over head name, English name, address, family code and every member's name and mobile; family-code order. */
export function filterFamilies<T extends ListFamily>(families: T[], q: string): T[] {
  const query = q.trim();
  return families
    .filter((f) => {
      if (!query) return true;
      const key = [searchKey(f.headName), searchKey(f.headNameEn), searchKey(f.address), f.code.toLowerCase(), ...f.members.map((m) => m.searchKey)].join(" | ");
      return matchesSearch(key, query) || f.code.toLowerCase().includes(query.toLowerCase());
    })
    .sort((a, b) => collator.compare(a.code, b.code));
}

// ---------- Voters ----------
export type VoterTab = "eligible" | "pending";

export const isPendingVoter = (r: VoterRow) =>
  !r.result.eligible && r.result.reasons.some((x) => x === "AGE_BORDERLINE" || x === "PANTH_TO_VERIFY" || x === "AGE_UNKNOWN");

/** The rows of a Voters tab (eligible, or still to check), searched, in surname order. */
export function voterTab(rows: VoterRow[], tab: VoterTab, q: string): VoterRow[] {
  const query = q.trim();
  return sortBySurname(rows.filter((r) => (tab === "eligible" ? r.result.eligible : isPendingVoter(r)) && (!query || matchesSearch(r.member.searchKey, query))));
}

// ---------- Donations ----------
export const DONATION_SHOWS = ["UNPAID", "PAID", "EXEMPT", "ALL"] as const;
export type DonationShow = (typeof DONATION_SHOWS)[number];
export const asShow = (v: string | null | undefined): DonationShow => ((DONATION_SHOWS as readonly string[]).includes(v ?? "") ? (v as DonationShow) : "UNPAID");

export async function loadDonationRows(kind: DonationKind, year: number, show: DonationShow, q: string) {
  const families = await prisma.family.findMany({
    where: DUE_FAMILY,
    select: {
      id: true, code: true, headName: true, headNameEn: true,
      members: { where: { deletedAt: null, status: "ACTIVE" }, select: { mobile: true, searchKey: true, isHead: true }, orderBy: [{ isHead: "desc" }, { serial: "asc" }] },
      donations: { where: { kind, year } },
    },
  });
  const query = q.trim();
  return families
    .map((f) => ({ f, entry: f.donations[0] ?? null }))
    .filter(({ entry }) => show === "ALL" || (show === "UNPAID" ? !entry : entry?.status === show))
    .filter(({ f }) => {
      if (!query) return true;
      const key = [searchKey(f.headName), searchKey(f.headNameEn), f.code.toLowerCase(), ...f.members.map((m) => m.searchKey)].join(" | ");
      return matchesSearch(key, query) || f.code.toLowerCase().includes(query.toLowerCase());
    })
    .sort((a, b) => collator.compare(a.f.code, b.f.code));
}
export type DonationRow = Awaited<ReturnType<typeof loadDonationRows>>[number];

// ---------- Duplicates ----------
export function loadDupFamilies(): Promise<DupFamily[]> {
  return prisma.family.findMany({
    where: { ...LIVE, status: { not: "MOVED_OUT" } },
    select: {
      id: true, code: true, headName: true, address: true,
      members: { where: { ...LIVE, status: { not: "MOVED_OUT" } }, select: { id: true, firstName: true, middleName: true, surname: true, firstNameEn: true, surnameEn: true, mobile: true } },
    },
    orderBy: { code: "asc" },
  });
}

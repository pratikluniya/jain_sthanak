// Builds rows for voter list / member list exports (Excel and print).
// Headings in the chosen language (Marathi by default), digits always English (decided 27 Sep 2026).
// In English, names and addresses use the saved English spelling (address added 11 Oct 2026); education and occupation stay as entered.
import { currentAge } from "./eligibility";
import { exportDictFor, type Dict, type Lang } from "./i18n";
import { relationLabel } from "./relations";
import { evaluateAll, memberFullName, surnameFirstName, sortBySurname, type VoterRow } from "./members";
import { toEnglishName } from "./translit";
import { prisma } from "./db";
import { collator } from "./members";
import { asGap, hasAadhaarImage, hasGap, type Gap } from "./gaps";
import { familyAddress } from "./addressEn";
import type { DonationKind } from "@prisma/client";
import { asKind, rupees } from "./donations";
import { findDuplicates, type DupKind } from "./duplicates";
import {
  asShow, filterFamilies, filterMembers, loadDonationRows, loadDupFamilies, loadFamilies, loadMembers, voterTab,
  type DonationShow, type ListMember, type MemberMode, type VoterTab,
} from "./lists";

export type ListKind = "voters" | "members" | "families" | "donations" | "duplicates";
export const LIST_KINDS: ListKind[] = ["voters", "members", "families", "donations", "duplicates"];
/** File name start for downloads. */
export const fileBase = (list: ListKind) =>
  ({ voters: "voter-list", families: "head-of-family-list", members: "member-list", donations: "donation-list", duplicates: "duplicates" })[list];
export const asListKind = (v: string | null | undefined): ListKind => (LIST_KINDS.includes(v as ListKind) ? (v as ListKind) : "voters");

export const FIELDS = [
  "serial",
  "voterNo",
  "fullName",
  "gender",
  "age",
  "relation",
  "address",
  "mobile",
  "familyCode",
  "headName",
  "education",
  "occupation",
  "bloodGroup",
  "panth",
  "status",
  "kyc",
  "reasons",
] as const;
export type MemberField = (typeof FIELDS)[number];
const MEMBER_FIELDS = FIELDS.filter((f) => f !== "reasons");

/** Columns of the family list (one row per family: heads of family, address, phone). */
export const FAMILY_FIELDS = ["serial", "familyCode", "headName", "address", "area", "phone", "memberCount", "panth"] as const;
export type FamilyField = (typeof FAMILY_FIELDS)[number];
/** Donations screen (one row per family for the chosen donation and year). */
export const DONATION_FIELDS = ["serial", "familyCode", "headName", "phone", "donationStatus", "amount", "paidOn", "payMode", "receiptNo", "note"] as const;
/** Duplicates report (one row per pair). */
export const DUP_FIELDS = ["serial", "dupType", "family1", "person1", "family2", "person2", "why"] as const;
export type Field = MemberField | FamilyField | (typeof DONATION_FIELDS)[number] | (typeof DUP_FIELDS)[number];

export function fieldsFor(list: ListKind): readonly Field[] {
  if (list === "families") return FAMILY_FIELDS;
  if (list === "donations") return DONATION_FIELDS;
  if (list === "duplicates") return DUP_FIELDS;
  return list === "voters" ? FIELDS : MEMBER_FIELDS; // "reasons" (why not yet a voter) only on the voter list
}

export function fieldLabels(t: Dict): Record<Field, string> {
  return {
  serial: t.serialNo,
  voterNo: t.voterNo,
  fullName: t.fullName,
  gender: t.gender,
  age: t.age,
  relation: t.relation,
  address: t.address,
  mobile: t.mobile,
  familyCode: t.familyCode,
  headName: t.headName,
  education: t.education,
  occupation: t.occupation,
  bloodGroup: t.bloodGroup,
  panth: t.panth,
  status: t.status,
  kyc: t.kyc,
  area: t.area,
  phone: t.phone,
  memberCount: t.memberCount,
  reasons: t.dup_why,
  donationStatus: t.status,
  amount: t.amount,
  paidOn: t.dl_paidOn,
  payMode: t.paymentMode,
  receiptNo: t.receiptNo,
  note: t.notes,
  dupType: t.dl_type,
  family1: t.dl_family1,
  person1: t.dl_person1,
  family2: t.dl_family2,
  person2: t.dl_person2,
  why: t.dup_why,
  };
}

export const DEFAULT_FIELDS: Record<ListKind, Field[]> = {
  voters: ["serial", "voterNo", "fullName", "gender", "age", "address", "mobile"],
  members: ["serial", "familyCode", "fullName", "gender", "age", "relation", "mobile", "bloodGroup", "address"],
  families: ["serial", "headName", "address", "phone"],
  donations: ["serial", "familyCode", "headName", "phone", "donationStatus", "amount", "paidOn", "receiptNo"],
  duplicates: ["serial", "dupType", "family1", "person1", "family2", "person2", "why"],
};

/**
 * What is on screen (7 Nov 2026): the tab and filters of the list, so a download gives exactly those rows.
 * Read from the address of the page (?q=..&gap=..) and passed on to the Excel / print / PDF links.
 */
export interface ExportFilters {
  q: string;
  blood: string;
  gap: Gap | null;
  memberMode: MemberMode; // members: normal / deceased without date / moved out
  moved: boolean; // families: moved-out list
  toVerify: boolean; // families: panth to verify
  tab: VoterTab; // voters: eligible / still to check
  kind: DonationKind; // donations
  year: number | null;
  show: DonationShow;
  dupKind: DupKind | null;
}

const DUP_KINDS: DupKind[] = ["SAME_FAMILY_TWICE", "SAME_PERSON_2_FAMILIES", "SAME_PERSON_IN_FAMILY", "SHARED_MOBILE"];

export function filtersFrom(get: (k: string) => string | null | undefined): ExportFilters {
  const year = parseInt(get("year") ?? "", 10);
  const dk = get("dupKind") ?? "";
  return {
    q: (get("q") ?? "").trim(),
    blood: get("blood") ?? "",
    gap: asGap(get("gap")),
    memberMode: get("nodod") === "1" ? "nodod" : get("moved") === "1" ? "moved" : "normal",
    moved: get("moved") === "1",
    toVerify: get("panth") === "TO_VERIFY",
    tab: get("tab") === "pending" ? "pending" : "eligible",
    kind: asKind(get("kind")),
    year: Number.isFinite(year) ? year : null,
    show: asShow(get("show")),
    dupKind: (DUP_KINDS as string[]).includes(dk) ? (dk as DupKind) : null,
  };
}

/** The filter part of a download link ("&q=..&gap=.."), only what this list uses and only values that are set. */
export function filterQuery(list: ListKind, f: Partial<ExportFilters>): string {
  const p: Record<string, string | undefined> = {};
  if (f.q) p.q = f.q;
  if (list === "members") {
    if (f.blood) p.blood = f.blood;
    if (f.gap) p.gap = f.gap;
    if (f.memberMode === "nodod") p.nodod = "1";
    if (f.memberMode === "moved") p.moved = "1";
  }
  if (list === "families") {
    if (f.moved) p.moved = "1";
    if (f.toVerify) p.panth = "TO_VERIFY";
  }
  if (list === "voters" && f.tab === "pending") p.tab = "pending";
  if (list === "donations") {
    if (f.kind) p.kind = f.kind;
    if (f.year) p.year = String(f.year);
    if (f.show) p.show = f.show;
  }
  if (list === "duplicates" && f.dupKind) p.dupKind = f.dupKind;
  return Object.entries(p).map(([k, v]) => `&${k}=${encodeURIComponent(v ?? "")}`).join("");
}

/** Short words for the file name, e.g. "nomobile", "pending", "moved". */
export function fileTag(list: ListKind, f: ExportFilters): string {
  const bits: string[] = [];
  if (list === "members") bits.push(f.gap ?? "", f.memberMode === "normal" ? "" : f.memberMode, f.blood ? `blood-${f.blood.replace("+", "pos").replace("-", "neg")}` : "");
  if (list === "families") bits.push(f.moved ? "moved" : "", f.toVerify ? "panth-to-verify" : "");
  if (list === "voters" && f.tab === "pending") bits.push("pending");
  if (list === "donations") bits.push(f.kind.toLowerCase().replace("_", "-"), f.year ? String(f.year) : "", f.show.toLowerCase());
  if (list === "duplicates" && f.dupKind) bits.push(f.dupKind.toLowerCase().replace(/_/g, "-"));
  if (f.q) bits.push("search");
  return bits.filter(Boolean).map((b) => `-${b}`).join("");
}

export function parseFields(raw: string | null | undefined, list: ListKind): Field[] {
  const allowed = fieldsFor(list) as readonly string[];
  const f = (raw ?? "").split(",").filter((x): x is Field => allowed.includes(x));
  return f.length ? f : DEFAULT_FIELDS[list];
}

/** Default columns for a tab (the voters "still to check" tab also shows why). */
export function defaultFieldsFor(list: ListKind, f: Partial<ExportFilters> = {}): Field[] {
  if (list === "voters" && f.tab === "pending") return ["serial", "fullName", "age", "familyCode", "mobile", "reasons"];
  return DEFAULT_FIELDS[list];
}

export interface ExportData {
  title: string;
  subtitle: string;
  headers: string[];
  rows: (string | number)[][];
}

const enCollator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

function sortByEnglishSurname(rows: VoterRow[]): VoterRow[] {
  const key = (r: VoterRow) => [r.member.surnameEn || toEnglishName(r.member.surname), r.member.firstNameEn || toEnglishName(r.member.firstName)];
  return [...rows].sort((a, b) => {
    const [as, af] = key(a);
    const [bs, bf] = key(b);
    return enCollator.compare(as, bs) || enCollator.compare(af, bf);
  });
}

/** Phone for a family: the head's mobile, else the first member (form order) who has one. */
export function familyPhone(members: { isHead: boolean; serial: number; mobile: string }[]): string {
  const head = members.find((m) => m.isHead && m.mobile);
  if (head) return head.mobile;
  return [...members].sort((a, b) => a.serial - b.serial).find((m) => m.mobile)?.mobile ?? "";
}

/** Words for the title of a download: the tab and filters used, e.g. "मोबाईल नंबर नसलेले सदस्य · शोध: Jain". */
export function describe(list: ListKind, f: ExportFilters, t: Dict): string {
  const bits: string[] = [];
  if (list === "voters") bits.push(t.voterList, f.tab === "pending" ? t.pendingCount : "");
  if (list === "members") {
    bits.push(f.gap ? t[`list_${f.gap}`] : f.memberMode === "nodod" ? t.missingDod : f.memberMode === "moved" ? `${t.allMembers}: ${t.MOVED_OUT}` : t.allMembers);
    if (f.blood) bits.push(`${t.dl_bloodGroup}: ${f.blood}`);
  }
  if (list === "families") bits.push(t.headList, f.toVerify ? `${t.panth}: ${t.toVerify}` : "", f.moved ? t.MOVED_OUT : "");
  if (list === "donations") bits.push(`${t.dl_donationList}: ${t[f.kind]} ${f.year ?? ""}`.trim(), t[f.show]);
  if (list === "duplicates") bits.push(t.dup_title, f.dupKind ? t[`dup_${f.dupKind}`] : "");
  if (f.q) bits.push(`${t.dl_search}: ${f.q}`);
  return bits.filter(Boolean).join(" · ");
}

/** One row per family, as on the Families screen for the same tab and search. */
async function buildFamilyExport(fields: Field[], lang: Lang, f: ExportFilters): Promise<ExportData> {
  const t = exportDictFor(lang);
  const english = lang === "en";
  const labels = fieldLabels(t);
  const families = filterFamilies(await loadFamilies({ moved: f.moved, toVerify: f.toVerify }), f.q);
  const head = (x: (typeof families)[number]) => (english ? x.headNameEn || toEnglishName(x.headName) : x.headName);
  const sorted = [...families].sort((a, b) => (english ? enCollator.compare(head(a), head(b)) : collator.compare(a.headName, b.headName)));
  const rows = sorted.map((x, i) => {
    const value: Partial<Record<Field, string | number>> = {
      serial: i + 1,
      familyCode: x.code,
      headName: head(x),
      address: familyAddress(x, english),
      area: x.area,
      phone: familyPhone(x.members),
      memberCount: x.members.length,
      panth: x.panthStatus === "CONFIRMED" ? t[x.panth] : t.toVerify,
    };
    return fields.map((k) => value[k] ?? "");
  });
  return { title: describe("families", f, t), subtitle: `${t.sangh} · ${t.total}: ${rows.length}`, headers: fields.map((k) => labels[k]), rows };
}

/** Donations screen rows for the chosen donation, year, status tab and search. */
async function buildDonationExport(fields: Field[], lang: Lang, f: ExportFilters): Promise<ExportData> {
  const t = exportDictFor(lang);
  const english = lang === "en";
  const labels = fieldLabels(t);
  const year = f.year ?? new Date().getFullYear();
  const rows = (await loadDonationRows(f.kind, year, f.show, f.q)).map(({ f: fam, entry }, i) => {
    const value: Partial<Record<Field, string | number>> = {
      serial: i + 1,
      familyCode: fam.code,
      headName: english ? fam.headNameEn || toEnglishName(fam.headName) : fam.headName,
      phone: fam.members.find((m) => m.mobile)?.mobile ?? "",
      donationStatus: entry ? t[entry.status] : t.UNPAID,
      amount: entry?.amount != null ? rupees(entry.amount) : "",
      paidOn: entry?.paidOn ? entry.paidOn.toLocaleDateString("en-IN") : "",
      payMode: entry?.mode ? t[entry.mode] : "",
      receiptNo: entry?.receiptNo ?? "",
      note: entry?.note ?? "",
    };
    return fields.map((k) => value[k] ?? "");
  });
  return { title: describe("donations", { ...f, year }, t), subtitle: `${t.sangh} · ${t.total}: ${rows.length}`, headers: fields.map((k) => labels[k]), rows };
}

/** Duplicates report rows for the chosen type (all types when none is given). */
async function buildDuplicateExport(fields: Field[], lang: Lang, f: ExportFilters): Promise<ExportData> {
  const t = exportDictFor(lang);
  const labels = fieldLabels(t);
  const pairs = findDuplicates(await loadDupFamilies()).filter((p) => !f.dupKind || p.kind === f.dupKind);
  const rows = pairs.map((p, i) => {
    const value: Partial<Record<Field, string | number>> = {
      serial: i + 1,
      dupType: t[`dup_${p.kind}`],
      family1: `${p.a.code} ${p.a.headName}`,
      person1: p.a.name ?? "",
      family2: `${p.b.code} ${p.b.headName}`,
      person2: p.b.name ?? "",
      why: p.why.join(", "),
    };
    return fields.map((k) => value[k] ?? "");
  });
  return { title: describe("duplicates", f, t), subtitle: `${t.sangh} · ${t.total}: ${rows.length}`, headers: fields.map((k) => labels[k]), rows };
}

export const EMPTY_FILTERS: ExportFilters = filtersFrom(() => null);

/**
 * Rows of a download. filters = the tab and search of the screen it came from (7 Nov 2026), so the file has
 * exactly the rows on screen (all of them, not only the ones loaded so far).
 */
export async function buildExport(list: ListKind, fields: Field[], lang: Lang = "mr", filters: Partial<ExportFilters> = {}): Promise<ExportData> {
  const f: ExportFilters = { ...EMPTY_FILTERS, ...filters };
  if (list === "families") return buildFamilyExport(fields, lang, f);
  if (list === "donations") return buildDonationExport(fields, lang, f);
  if (list === "duplicates") return buildDuplicateExport(fields, lang, f);
  const t = exportDictFor(lang);
  const english = lang === "en";
  const labels = fieldLabels(t);

  type Row = { member: VoterRow["member"] | ListMember; family: VoterRow["family"]; result?: VoterRow["result"] };
  let picked: Row[];
  let ageDate: Date | null = null;
  if (list === "voters") {
    const all = await evaluateAll();
    ageDate = all.ageDate;
    picked = voterTab(all.rows, f.tab, f.q);
  } else {
    picked = filterMembers(await loadMembers(f.memberMode), f).map((m) => ({ member: m, family: m.family }));
  }
  const sorted = english ? (sortByEnglishSurname(picked as VoterRow[]) as Row[]) : picked;

  const out = sorted.map((r, i) => {
    const m = r.member;
    const fam = r.family;
    const age = list === "voters" && r.result ? (r.result.reasons.includes("AGE_BORDERLINE") ? `${r.result.age.min}-${r.result.age.max}` : (r.result.age.min ?? "")) : (currentAge(m) ?? "");
    const value: Partial<Record<Field, string | number>> = {
      serial: i + 1,
      voterNo: m.voterNo ?? "",
      fullName: list === "voters" && f.tab === "eligible" ? surnameFirstName(m, english) : memberFullName(m, true, english),
      gender: m.gender === "UNKNOWN" ? "" : t[m.gender],
      age,
      relation: relationLabel(m.relation, lang),
      address: familyAddress(fam, english),
      mobile: m.mobile,
      familyCode: fam.code,
      headName: english ? fam.headNameEn || toEnglishName(fam.headName) : fam.headName,
      education: m.education,
      occupation: m.occupation,
      bloodGroup: m.bloodGroup,
      panth: fam.panthStatus === "CONFIRMED" ? t[fam.panth] : t.toVerify,
      status: t[m.status],
      kyc: hasAadhaarImage(m) ? t.aadhaarUploaded : hasGap(m, "noaadhaar") ? t.noaadhaar : "",
      reasons: r.result ? r.result.reasons.map((x) => t[x]).join(", ") : "",
    };
    return fields.map((k) => value[k] ?? "");
  });

  const dateStr = ageDate?.toLocaleDateString("en-IN") ?? "";
  return {
    title: describe(list, f, t),
    subtitle: list === "voters" ? `${t.sangh} · ${t.ageRuleShort} ${dateStr} · ${t.total}: ${out.length}` : `${t.sangh} · ${t.total}: ${out.length}`,
    headers: fields.map((k) => labels[k]),
    rows: out,
  };
}

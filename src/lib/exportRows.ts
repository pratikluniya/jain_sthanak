// Builds rows for voter list / member list exports (Excel and print).
// Headings in the chosen language (Marathi by default), digits always English (decided 27 Sep 2026).
// In English, names use the saved English spelling; addresses, education and occupation stay as entered.
import { exportDictFor, type Dict, type Lang } from "./i18n";
import { relationLabel } from "./relations";
import { evaluateAll, memberFullName, sortBySurname, type VoterRow } from "./members";
import { toEnglishName } from "./translit";

export type ListKind = "voters" | "members";

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
] as const;
export type Field = (typeof FIELDS)[number];

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
  };
}

export const DEFAULT_FIELDS: Record<ListKind, Field[]> = {
  voters: ["serial", "voterNo", "fullName", "gender", "age", "address", "mobile"],
  members: ["serial", "familyCode", "fullName", "gender", "age", "relation", "mobile", "bloodGroup", "address"],
};

export function parseFields(raw: string | null | undefined, list: ListKind): Field[] {
  const f = (raw ?? "").split(",").filter((x): x is Field => (FIELDS as readonly string[]).includes(x));
  return f.length ? f : DEFAULT_FIELDS[list];
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

export async function buildExport(list: ListKind, fields: Field[], lang: Lang = "mr"): Promise<ExportData> {
  const t = exportDictFor(lang);
  const english = lang === "en";
  const labels = fieldLabels(t);
  const { rows, ageDate } = await evaluateAll();
  const picked = list === "voters" ? rows.filter((r) => r.result.eligible) : rows;
  const sorted = english ? sortByEnglishSurname(picked) : sortBySurname(picked);
  const dateStr = ageDate.toLocaleDateString("en-IN");

  const out = sorted.map((r, i) => {
    const m = r.member;
    const f = r.family;
    const age = list === "voters" ? (r.result.age.min ?? "") : (m.age ?? "");
    const value: Record<Field, string | number> = {
      serial: i + 1,
      voterNo: m.voterNo ?? "",
      fullName: memberFullName(m, true, english),
      gender: m.gender === "UNKNOWN" ? "" : t[m.gender],
      age,
      relation: relationLabel(m.relation, lang),
      address: f.address,
      mobile: m.mobile,
      familyCode: f.code,
      headName: english ? f.headNameEn || toEnglishName(f.headName) : f.headName,
      education: m.education,
      occupation: m.occupation,
      bloodGroup: m.bloodGroup,
      panth: f.panthStatus === "CONFIRMED" ? t[f.panth] : t.toVerify,
      status: t[m.status],
      kyc: m.kycVerified ? t.kycVerified : m.aadhaarLast4 || m.kycFileKey ? t.kycPending : "",
    };
    return fields.map((k) => value[k]);
  });

  return {
    title: list === "voters" ? t.voterList : t.allMembers,
    subtitle:
      list === "voters"
        ? `${t.sangh} · ${t.ageRuleShort} ${dateStr} · ${t.total}: ${out.length}`
        : `${t.sangh} · ${t.total}: ${out.length}`,
    headers: fields.map((k) => labels[k]),
    rows: out,
  };
}

// Builds rows for voter list / member list exports (Excel and print).
// Exports are always Marathi headings with English digits (decided 27 Sep 2026).
import { exportDict as t } from "./i18n";
import { relationLabel } from "./relations";
import { evaluateAll, memberFullName, sortBySurname } from "./members";

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

export const FIELD_LABEL: Record<Field, string> = {
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

export async function buildExport(list: ListKind, fields: Field[]): Promise<ExportData> {
  const { rows, ageDate } = await evaluateAll();
  const picked = list === "voters" ? rows.filter((r) => r.result.eligible) : rows;
  const sorted = sortBySurname(picked);
  const dateStr = ageDate.toLocaleDateString("en-IN");

  const out = sorted.map((r, i) => {
    const m = r.member;
    const f = r.family;
    const age = list === "voters" ? (r.result.age.min ?? "") : (m.age ?? "");
    const value: Record<Field, string | number> = {
      serial: i + 1,
      voterNo: m.voterNo ?? "",
      fullName: memberFullName(m),
      gender: m.gender === "UNKNOWN" ? "" : t[m.gender],
      age,
      relation: relationLabel(m.relation, "mr"),
      address: f.address,
      mobile: m.mobile,
      familyCode: f.code,
      headName: f.headName,
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
    headers: fields.map((k) => FIELD_LABEL[k]),
    rows: out,
  };
}

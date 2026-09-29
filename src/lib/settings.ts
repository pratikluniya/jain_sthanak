import { prisma } from "./db";

export interface AppSettings {
  electionDate: Date | null;
  applyStatusRules: boolean;
  sanghName: string;
  sanghAddress: string;
  sanghRegNo: string;
  receiptPurposes: string[];
}

export const DEFAULTS: Record<string, string> = {
  electionDate: "",
  applyStatusRules: "false",
  sanghName: "श्री जैन स्थानकवासी श्रावक संघ, नाशिकरोड",
  sanghAddress: "दुर्गा उद्यान समोर, महावीर नगर, नाशिकरोड, देवळाली - 422101",
  sanghRegNo: "PTA Reg. No. A577-NSK",
  receiptPurposes: JSON.stringify(["चातुर्मास गौतम प्रसादी", "महावीर जन्मकल्याणक", "देणगी"]),
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await prisma.setting.findMany();
  const m: Record<string, string> = { ...DEFAULTS };
  for (const r of rows) m[r.key] = r.value;
  let purposes: string[] = [];
  try {
    purposes = JSON.parse(m.receiptPurposes);
  } catch {
    purposes = [];
  }
  return {
    electionDate: m.electionDate ? new Date(m.electionDate) : null,
    applyStatusRules: m.applyStatusRules === "true",
    sanghName: m.sanghName,
    sanghAddress: m.sanghAddress,
    sanghRegNo: m.sanghRegNo,
    receiptPurposes: purposes,
  };
}

export async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

/** Election date if set, otherwise today (so the voter list still works before the date is fixed). */
export function effectiveElectionDate(s: AppSettings): Date {
  return s.electionDate ?? new Date();
}

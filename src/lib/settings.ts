import { prisma } from "./db";

export interface AppSettings {
  electionDate: Date | null;
  ageCutoffDate: Date | null;
  applyStatusRules: boolean;
  sanghName: string;
  sanghAddress: string;
  sanghRegNo: string;
  receiptPurposes: string[];
  /** public voter search page /search (no login): Admin turns it on around the election */
  publicSearchEnabled: boolean;
  /** shown on /search when a name is not found */
  helpDeskMessage: string;
}

export const DEFAULTS: Record<string, string> = {
  electionDate: "",
  ageCutoffDate: "2026-10-01",
  applyStatusRules: "false",
  sanghName: "श्री जैन स्थानकवासी श्रावक संघ, नाशिकरोड",
  sanghAddress: "दुर्गा उद्यान समोर, महावीर नगर, नाशिकरोड, देवळाली - 422101",
  sanghRegNo: "PTA Reg. No. A577-NSK",
  publicSearchEnabled: "false",
  helpDeskMessage: "",
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
    ageCutoffDate: m.ageCutoffDate ? new Date(m.ageCutoffDate) : null,
    applyStatusRules: m.applyStatusRules === "true",
    sanghName: m.sanghName,
    sanghAddress: m.sanghAddress,
    sanghRegNo: m.sanghRegNo,
    receiptPurposes: purposes,
    publicSearchEnabled: m.publicSearchEnabled === "true",
    helpDeskMessage: m.helpDeskMessage,
  };
}

export async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

/** Date on which the 18+ age rule is checked: age cut-off date, else election date, else today. */
export function effectiveAgeDate(s: AppSettings): Date {
  return s.ageCutoffDate ?? s.electionDate ?? new Date();
}

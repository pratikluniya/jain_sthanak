// The settings shown on the Settings page: grouped by what they are used for, each edited on its own page.
import type { Dict } from "@/lib/i18n";
import type { AppSettings } from "@/lib/settings";
import { RECEIPTS_ENABLED } from "@/lib/features";

export type SettingKey = "ageCutoffDate" | "electionDate" | "applyStatusRules" | "sanghName" | "sanghAddress" | "sanghRegNo" | "receiptPurposes";
export type SettingKind = "date" | "dateOptional" | "onOff" | "text" | "longText" | "lines";

export interface SettingDef {
  key: SettingKey;
  kind: SettingKind;
  label: (t: Dict) => string;
  usedFor: (t: Dict) => string;
}

export interface SettingGroup {
  title: (t: Dict) => string;
  items: SettingDef[];
}

const ELECTION: SettingGroup = {
  title: (t) => t.catElection,
  items: [
    { key: "ageCutoffDate", kind: "date", label: (t) => t.ageCutoffDate, usedFor: (t) => t.use_ageCutoff },
    { key: "electionDate", kind: "dateOptional", label: (t) => t.electionDate, usedFor: (t) => t.use_electionDate },
    { key: "applyStatusRules", kind: "onOff", label: (t) => t.statusRulesShort, usedFor: (t) => t.use_statusRules },
  ],
};

// These four are printed only on receipts, so they are hidden together with receipts (phase 2).
const RECEIPTS: SettingGroup = {
  title: (t) => t.receipts,
  items: [
    { key: "sanghName", kind: "text", label: (t) => t.sanghNameLabel, usedFor: (t) => t.receipts },
    { key: "sanghAddress", kind: "longText", label: (t) => t.sanghAddressLabel, usedFor: (t) => t.receipts },
    { key: "sanghRegNo", kind: "text", label: (t) => t.regNoLabel, usedFor: (t) => t.receipts },
    { key: "receiptPurposes", kind: "lines", label: (t) => t.receiptPurposesLabel, usedFor: (t) => t.receipts },
  ],
};

export const SETTING_GROUPS: SettingGroup[] = RECEIPTS_ENABLED ? [ELECTION, RECEIPTS] : [ELECTION];

export function findSetting(key: string): SettingDef | undefined {
  return SETTING_GROUPS.flatMap((g) => g.items).find((i) => i.key === key);
}

const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

/** Value as stored in the form field. */
export function formValue(s: AppSettings, key: SettingKey): string {
  switch (key) {
    case "ageCutoffDate": return isoDay(s.ageCutoffDate);
    case "electionDate": return isoDay(s.electionDate);
    case "applyStatusRules": return s.applyStatusRules ? "true" : "false";
    case "receiptPurposes": return s.receiptPurposes.join("\n");
    default: return s[key];
  }
}

/** Value as shown in the table. */
export function displayValue(s: AppSettings, def: SettingDef, t: Dict): string {
  const v = formValue(s, def.key);
  if (def.kind === "onOff") return v === "true" ? t.on : t.off;
  if (def.kind === "date" || def.kind === "dateOptional") return v ? new Date(v).toLocaleDateString("en-IN") : t.notSet;
  if (def.kind === "lines") return s.receiptPurposes.join(", ") || t.notSet;
  return v || t.notSet;
}

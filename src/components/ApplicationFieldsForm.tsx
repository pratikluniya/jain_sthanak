// The fields of the individual membership application (सभासद अर्ज), used on the check screen and the edit page.
// Plain inputs (no client state): the surrounding <form> posts them; names match applicationFromForm().
import type { Dict } from "@/lib/i18n";
import { DOC_CODES } from "@/lib/applicationForm";

export interface ApplicationDefaults {
  appNo: string;
  appDate: string; // YYYY-MM-DD
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

/** "as written on the form" hint shown under a date field when the written text could not be read as a date */
export type RawHints = Partial<Record<"appDate" | "receiptDate" | "meetingDate" | "dob", string>>;

export function Field(p: { name: string; label: string; value: string; type?: string; inputMode?: "numeric" | "tel" | "email"; hint?: string; uncertain?: boolean; required?: boolean }) {
  return (
    <div>
      <label className="label" htmlFor={p.name}>
        {p.label} {p.uncertain && <span className="text-amber-600" title="?">⚠</span>}
      </label>
      <input id={p.name} name={p.name} className={`input ${p.uncertain ? "border-amber-400 bg-amber-50" : ""}`} defaultValue={p.value} type={p.type ?? "text"} inputMode={p.inputMode} required={p.required} />
      {p.hint && <p className="mt-0.5 text-xs text-stone-500">{p.hint}</p>}
    </div>
  );
}

export default function ApplicationFieldsForm({ d, t, raw = {}, uncertain = [] }: { d: ApplicationDefaults; t: Dict; raw?: RawHints; uncertain?: string[] }) {
  const u = (k: string) => uncertain.includes(k);
  const written = (k: keyof RawHints, value: string) => (raw[k] && !value ? `${t.onForm}: ${raw[k]}` : undefined);
  const person = (who: "proposer" | "seconder", legend: string) => (
    <fieldset className="rounded-lg border p-3 space-y-2">
      <legend className="px-1 text-sm font-semibold">{legend}</legend>
      <Field name={`${who}Name`} label={t.name} value={d[`${who}Name`]} uncertain={u(who)} />
      <Field name={`${who}Address`} label={t.address} value={d[`${who}Address`]} />
      <div className="grid grid-cols-2 gap-2">
        <Field name={`${who}Mobile`} label={t.mobile} value={d[`${who}Mobile`]} inputMode="tel" />
        <Field name={`${who}Landline`} label={t.landline} value={d[`${who}Landline`]} inputMode="tel" />
      </div>
    </fieldset>
  );

  return (
    <div className="space-y-3">
      <fieldset className="rounded-lg border p-3 space-y-2">
        <legend className="px-1 text-sm font-semibold">{t.applicationTitle}</legend>
        <div className="grid grid-cols-2 gap-2">
          <Field name="appNo" label={t.appNo} value={d.appNo} uncertain={u("appNo")} />
          <Field name="appDate" label={t.appDate} value={d.appDate} type="date" hint={written("appDate", d.appDate)} uncertain={u("appDate")} />
        </div>
        <Field name="homeAddress" label={t.homeAddress} value={d.homeAddress} uncertain={u("homeAddress")} />
        <Field name="businessAddress" label={t.businessAddress} value={d.businessAddress} uncertain={u("businessAddress")} />
        <div className="grid grid-cols-2 gap-2">
          <Field name="landline" label={t.landline} value={d.landline} inputMode="tel" />
          <Field name="email" label={t.email} value={d.email} type="email" inputMode="email" uncertain={u("email")} />
        </div>
      </fieldset>

      <fieldset className="rounded-lg border p-3 space-y-2">
        <legend className="px-1 text-sm font-semibold">{t.fees}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field name="feeEntry" label={t.feeEntry} value={d.feeEntry} inputMode="numeric" />
          <Field name="feeAnnual" label={t.feeAnnual} value={d.feeAnnual} inputMode="numeric" />
          <Field name="feeLifetime" label={t.feeLifetime} value={d.feeLifetime} inputMode="numeric" />
          <Field name="feeTotal" label={t.feeTotal} value={d.feeTotal} inputMode="numeric" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field name="receiptNo" label={t.receiptNoForm} value={d.receiptNo} />
          <Field name="receiptDate" label={t.receiptDateForm} value={d.receiptDate} type="date" hint={written("receiptDate", d.receiptDate)} />
        </div>
      </fieldset>

      <div className="grid gap-3 lg:grid-cols-2">
        {person("proposer", t.proposer)}
        {person("seconder", t.seconder)}
      </div>

      <fieldset className="rounded-lg border p-3 space-y-2">
        <legend className="px-1 text-sm font-semibold">{t.officeDecision}</legend>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="decision">{t.decision}</label>
            <select id="decision" name="decision" className="input" defaultValue={d.decision || "APPROVED"}>
              {(["APPROVED", "PENDING", "REJECTED"] as const).map((x) => <option key={x} value={x}>{t[`dec_${x}`]}</option>)}
            </select>
          </div>
          <Field name="meetingDate" label={t.meetingDate} value={d.meetingDate} type="date" hint={written("meetingDate", d.meetingDate)} uncertain={u("meetingDate")} />
        </div>
        <Field name="rejectReasons" label={t.rejectReasons} value={d.rejectReasons} />
        <p className="text-xs text-stone-500">{t.decisionHelp}</p>
      </fieldset>

      <fieldset className="rounded-lg border p-3 space-y-2">
        <legend className="px-1 text-sm font-semibold">{t.documentsGiven}</legend>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
          {DOC_CODES.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="docs" value={c} defaultChecked={d.docs.includes(c)} /> {t[`doc_${c}`]}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="label" htmlFor="notes">{t.notes}</label>
        <textarea id="notes" name="notes" className="input" rows={2} defaultValue={d.notes} />
      </div>
    </div>
  );
}

/** Database row -> form defaults */
export function defaultsFromRecord(a: {
  appNo: string; appDate: Date | null; homeAddress: string; businessAddress: string; email: string; landline: string;
  feeEntry: number | null; feeAnnual: number | null; feeLifetime: number | null; feeTotal: number | null; receiptNo: string; receiptDate: Date | null;
  proposerName: string; proposerAddress: string; proposerMobile: string; proposerLandline: string;
  seconderName: string; seconderAddress: string; seconderMobile: string; seconderLandline: string;
  decision: string; meetingDate: Date | null; rejectReasons: string; docs: string[]; notes: string;
}): ApplicationDefaults {
  const day = (x: Date | null) => (x ? x.toISOString().slice(0, 10) : "");
  const num = (x: number | null) => (x === null ? "" : String(x));
  return {
    ...a,
    appDate: day(a.appDate),
    receiptDate: day(a.receiptDate),
    meetingDate: day(a.meetingDate),
    feeEntry: num(a.feeEntry),
    feeAnnual: num(a.feeAnnual),
    feeLifetime: num(a.feeLifetime),
    feeTotal: num(a.feeTotal),
  };
}

// The status of one family for one donation and year, with the buttons to change it.
// Used on the Donations screen and on the family page. Plain forms: works without extra JavaScript.
import type { Donation, DonationKind } from "@prisma/client";
import type { Dict } from "@/lib/i18n";
import ConfirmButton from "@/components/ConfirmButton";
import { DONATION_MODES, rupees } from "@/lib/donations";
import { markExemptAction, recordPaymentAction, removeDonationAction } from "./actions";

export function StatusBadge({ entry, t }: { entry: Pick<Donation, "status"> | null | undefined; t: Dict }) {
  if (!entry) return <span className="badge-red">{t.UNPAID}</span>;
  return entry.status === "PAID" ? <span className="badge-green">✔ {t.PAID}</span> : <span className="badge-gray">{t.EXEMPT}</span>;
}

export function EntryDetails({ entry, t, by }: { entry: Donation; t: Dict; by?: string }) {
  const bits =
    entry.status === "PAID"
      ? [entry.paidOn?.toLocaleDateString("en-IN"), entry.amount !== null ? rupees(entry.amount) : "", entry.mode ? t[entry.mode] : "", entry.receiptNo && `${t.receiptNo} ${entry.receiptNo}`]
      : [];
  return (
    <span className="text-xs text-stone-600">
      {[...bits, entry.note, by && `${t.enteredBy}: ${by}`].filter(Boolean).join(" · ")}
    </span>
  );
}

export default function EntryControls(p: {
  familyId: string;
  kind: DonationKind;
  year: number;
  amount: number;
  entry: Donation | null | undefined;
  canRecord: boolean;
  canAdmin: boolean;
  t: Dict;
  label?: string; // shown in the confirm message, e.g. "NR-0012 · Mahavir Jayanti 2026"
}) {
  const { t, entry } = p;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const hidden = (
    <>
      <input type="hidden" name="familyId" value={p.familyId} />
      <input type="hidden" name="kind" value={p.kind} />
      <input type="hidden" name="year" value={p.year} />
    </>
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      {p.canRecord && (
        <details className="group">
          <summary className={`${entry?.status === "PAID" ? "btn-secondary" : "btn-primary"} btn-sm cursor-pointer list-none`}>
            {entry?.status === "PAID" ? t.editPayment : t.markPaid}
          </summary>
          <form action={recordPaymentAction} className="mt-2 grid grid-cols-2 gap-2 rounded-lg border bg-stone-50 p-3 sm:grid-cols-3">
            {hidden}
            <label className="text-xs">
              {t.date}
              <input className="input" type="date" name="paidOn" required max={today} defaultValue={entry?.paidOn ? entry.paidOn.toISOString().slice(0, 10) : today} />
            </label>
            <label className="text-xs">
              {t.amount} (₹)
              <input className="input" name="amount" inputMode="numeric" required defaultValue={String(entry?.amount ?? p.amount)} />
            </label>
            <label className="text-xs">
              {t.paymentMode}
              <select className="input" name="mode" defaultValue={entry?.mode ?? "CASH"}>
                {DONATION_MODES.map((m) => <option key={m} value={m}>{t[m]}</option>)}
              </select>
            </label>
            <label className="text-xs">
              {t.receiptNo}
              <input className="input" name="receiptNo" defaultValue={entry?.receiptNo ?? ""} />
            </label>
            <label className="col-span-2 text-xs">
              {t.donationNote}
              <input className="input" name="note" defaultValue={entry?.note ?? ""} />
            </label>
            <div className="col-span-2 sm:col-span-3">
              <button className="btn-primary btn-sm">{t.save}</button>
            </div>
          </form>
        </details>
      )}
      {p.canAdmin && entry?.status !== "EXEMPT" && (
        <details>
          <summary className="btn-secondary btn-sm cursor-pointer list-none">{t.markExempt}</summary>
          <form action={markExemptAction} className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border bg-stone-50 p-3">
            {hidden}
            <label className="text-xs">
              {t.donationNote}
              <input className="input" name="note" />
            </label>
            <ConfirmButton className="btn-secondary btn-sm" message={`${p.label ?? ""} ${t.markExempt}?`}>{t.save}</ConfirmButton>
          </form>
        </details>
      )}
      {p.canAdmin && entry && (
        <form action={removeDonationAction}>
          <input type="hidden" name="id" value={entry.id} />
          <ConfirmButton danger className="btn-danger btn-sm" message={`${p.label ?? ""}: ${t.removeEntryConfirm}`}>{t.removeEntry}</ConfirmButton>
        </form>
      )}
    </div>
  );
}

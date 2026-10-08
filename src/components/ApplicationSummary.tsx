// Membership application (सभासद अर्ज) details under a member on the family page (folded by default).
import Link from "next/link";
import type { MembershipApplication } from "@prisma/client";
import type { Dict } from "@/lib/i18n";

const day = (d: Date | null) => (d ? d.toLocaleDateString("en-IN") : "");
const rs = (n: number | null) => (n === null ? "" : `₹${n}`);

export default function ApplicationSummary({ a, t, editHref }: { a: MembershipApplication; t: Dict; editHref?: string }) {
  const rows: [string, string][] = [
    [t.appNo, [a.appNo, day(a.appDate)].filter(Boolean).join(" · ")],
    [t.homeAddress, a.homeAddress],
    [t.businessAddress, a.businessAddress],
    [t.landline, a.landline],
    [t.email, a.email],
    [t.fees, [a.feeEntry !== null && `${t.feeEntry} ${rs(a.feeEntry)}`, a.feeAnnual !== null && `${t.feeAnnual} ${rs(a.feeAnnual)}`, a.feeLifetime !== null && `${t.feeLifetime} ${rs(a.feeLifetime)}`, a.feeTotal !== null && `${t.feeTotal} ${rs(a.feeTotal)}`].filter(Boolean).join(" · ")],
    [t.receiptNoForm, [a.receiptNo, day(a.receiptDate)].filter(Boolean).join(" · ")],
    [t.proposer, [a.proposerName, a.proposerAddress, a.proposerMobile, a.proposerLandline].filter(Boolean).join(" · ")],
    [t.seconder, [a.seconderName, a.seconderAddress, a.seconderMobile, a.seconderLandline].filter(Boolean).join(" · ")],
    [t.meetingDate, day(a.meetingDate)],
    [t.rejectReasons, a.rejectReasons],
    [t.documentsGiven, a.docs.map((d) => t[`doc_${d}` as keyof Dict] ?? d).join(", ")],
    [t.notes, a.notes],
  ];
  const badge = a.decision === "APPROVED" ? "badge-green" : a.decision === "REJECTED" ? "badge-red" : "badge-amber";
  return (
    <details className="mt-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm">
      <summary className="cursor-pointer select-none">
        <b>{t.applicationTitle}</b>
        {a.appNo && ` #${a.appNo}`} <span className={`${badge} ml-1`}>{t[`dec_${a.decision}`]}</span>
      </summary>
      <dl className="mt-2 grid gap-x-3 gap-y-1 sm:grid-cols-[max-content_1fr]">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-stone-500">{k}</dt>
            <dd className="break-words">{v}</dd>
          </div>
        ))}
      </dl>
      {editHref && <Link href={editHref} className="btn-secondary btn-sm mt-2 inline-flex">{t.edit}</Link>}
    </details>
  );
}

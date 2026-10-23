// Families that have not paid for N years in a row (N = 1, 2, 3, 4+), per donation or either one.
import Link from "next/link";
import { getDict, getLang } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { collator, headLabel } from "@/lib/members";
import { DONATION_KINDS, arrearsFor, asKindOrAll, asMinYears, rupees } from "@/lib/donations";

export const dynamic = "force-dynamic";

export default async function ArrearsPage({ searchParams }: { searchParams: { min?: string; kind?: string } }) {
  const s = await requireSession("view");
  const t = getDict();
  const lang = getLang();
  const en = lang === "en";
  const min = asMinYears(searchParams.min);
  const kind = asKindOrAll(searchParams.kind);
  const rows = (await arrearsFor(min, kind)).sort((a, b) => collator.compare(a.family.code, b.family.code));
  const qs = (over: Record<string, string | number>) => `?${new URLSearchParams({ min: String(min), kind, ...Object.fromEntries(Object.entries(over).map(([k, v]) => [k, String(v)])) })}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title">{t.arrears} <span className="text-base text-stone-500">({rows.length})</span></h1>
        <div className="flex gap-2">
          {can(s.role, "export") && (
            <a className="btn-secondary" href={`/api/donations/export${qs({ lang })}`}>{t.downloadExcel}</a>
          )}
          <Link href="/donations" className="btn-secondary">← {t.donations}</Link>
        </div>
      </div>
      <p className="text-sm text-stone-600">{t.arrearsIntro}</p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">{t.unpaidYearsInRow}:</span>
        {[1, 2, 3, 4].map((n) => (
          <Link key={n} href={qs({ min: n })} className={n === min ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>{n}+</Link>
        ))}
        <span className="mx-1 text-stone-300">|</span>
        {(["ALL", ...DONATION_KINDS] as const).map((k) => (
          <Link key={k} href={qs({ kind: k })} className={k === kind ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>{t[k]}</Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-stone-500">{t.noFamiliesHere}</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>{t.familyCode}</th>
                <th>{t.headName}</th>
                <th>{t.mobile}</th>
                {DONATION_KINDS.map((k) => <th key={k}>{t[k]}: {t.unpaidYears}</th>)}
                <th>{t.pendingAmount}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.family.id}>
                  <td>{r.family.code}</td>
                  <td><Link className="text-brand-700" href={`/families/${r.family.id}`}>{headLabel(r.family, en)}</Link></td>
                  <td>{r.family.mobile && <a href={`tel:${r.family.mobile}`}>{r.family.mobile}</a>}</td>
                  {DONATION_KINDS.map((k) => (
                    <td key={k} className={r.streak[k] >= min ? "font-semibold text-red-700" : ""}>{r.unpaidYears[k].join(", ")}</td>
                  ))}
                  <td>{rupees(r.pendingAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

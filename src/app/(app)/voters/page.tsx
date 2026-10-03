import Link from "next/link";
import { getDict } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { evaluateAll, memberFullName, sortBySurname } from "@/lib/members";
import { matchesSearch } from "@/lib/normalize";
import type { Reason } from "@/lib/eligibility";
import SearchBox from "@/components/SearchBox";
import { assignVoterNumbers } from "./actions";

export const dynamic = "force-dynamic";

export default async function VotersPage({ searchParams }: { searchParams: { q?: string; tab?: string } }) {
  const s = await requireSession("view");
  const t = getDict();
  const tab = searchParams.tab === "pending" ? "pending" : "eligible";
  const q = (searchParams.q ?? "").trim();
  const { rows, ageDate, electionDate } = await evaluateAll();

  const eligible = rows.filter((r) => r.result.eligible);
  const pending = rows.filter((r) => !r.result.eligible && r.result.reasons.some((x) => x === "AGE_BORDERLINE" || x === "PANTH_TO_VERIFY" || x === "AGE_UNKNOWN"));
  const reasonCounts = new Map<Reason, number>();
  for (const r of rows) for (const x of r.result.reasons) reasonCounts.set(x, (reasonCounts.get(x) ?? 0) + 1);
  const withoutNo = eligible.filter((r) => r.member.voterNo === null).length;

  const list = sortBySurname((tab === "eligible" ? eligible : pending).filter((r) => !q || matchesSearch(r.member.searchKey, q)));

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">{t.voterList}</h1>
      <div className="card p-3 text-sm space-y-1">
        <div><b>{t.ageCutoffDate}:</b> {ageDate.toLocaleDateString("en-IN")}</div>
        <div><b>{t.electionDate}:</b> {electionDate ? electionDate.toLocaleDateString("en-IN") : <span className="text-amber-700">{t.electionDateNotSet}</span>}</div>
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="badge-green">{t.eligibleCount}: {eligible.length}</span>
          {[...reasonCounts.entries()].map(([k, v]) => (
            <span key={k} className={k === "UNDER_AGE" ? "badge-gray" : "badge-amber"}>{t[k]}: {v}</span>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {can(s.role, "approve") && withoutNo > 0 && (
          <form action={assignVoterNumbers}>
            <button className="btn-secondary">{t.assignVoterNos} ({withoutNo})</button>
          </form>
        )}
        {can(s.role, "export") && (
          <>
            <a href="/api/export?list=voters" className="btn-secondary">⬇ {t.downloadExcel}</a>
            <Link href="/print?list=voters" className="btn-secondary">🖨 {t.printPdf}</Link>
            <Link href="/export?list=voters" className="btn-secondary">{t.chooseFields}</Link>
          </>
        )}
      </div>
      <div className="flex gap-2 text-sm">
        <Link href="/voters" className={tab === "eligible" ? "badge-green font-semibold" : "badge-gray"}>{t.eligible} ({eligible.length})</Link>
        <Link href="/voters?tab=pending" className={tab === "pending" ? "badge-amber font-semibold" : "badge-gray"}>{t.pendingCount} ({pending.length})</Link>
      </div>
      <SearchBox q={q} placeholder={t.searchPlaceholder} label={t.search} />
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>{t.voterNo}</th>
              <th>{t.fullName}</th>
              <th>{t.age}</th>
              <th>{t.familyCode}</th>
              {tab === "pending" && <th>{t.status}</th>}
            </tr>
          </thead>
          <tbody>
            {list.map((r, i) => (
              <tr key={r.member.id}>
                <td>{i + 1}</td>
                <td>{r.member.voterNo ?? ""}</td>
                <td><Link className="text-brand-700" href={`/families/${r.family.id}`}>{memberFullName(r.member)}</Link></td>
                <td>{r.result.reasons.includes("AGE_BORDERLINE") ? `${r.result.age.min}-${r.result.age.max}` : r.result.age.min}</td>
                <td>{r.family.code}</td>
                {tab === "pending" && (
                  <td className="space-x-1">{r.result.reasons.map((x) => <span key={x} className="badge-amber">{t[x]}</span>)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

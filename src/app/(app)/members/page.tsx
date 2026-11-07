import LoadMore from "@/components/LoadMore";
import { moreHref, shownCount, STEP } from "@/lib/listPaging";
import { currentAge } from "@/lib/eligibility";
import { filterMembers, loadMembers } from "@/lib/lists";
import Link from "next/link";
import DownloadButton from "@/components/DownloadButton";
import { downloadProps } from "@/lib/downloadProps";
import { GAPS, asGap, hasGap, type Gap } from "@/lib/gaps";
import { getDict, getLang } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import { relationLabel } from "@/lib/relations";
import { memberFullName } from "@/lib/members";
import SearchBox from "@/components/SearchBox";
import { can } from "@/lib/rbac";
import { restoreMember } from "../families/actions";

export const dynamic = "force-dynamic";

export default async function MembersPage({ searchParams }: { searchParams: { q?: string; blood?: string; n?: string; deleted?: string; nodod?: string; moved?: string; gap?: string } }) {
  const s = await requireSession("view");
  const t = getDict();
  const lang = getLang();
  const en = lang === "en";
  const q = (searchParams.q ?? "").trim();
  const blood = searchParams.blood ?? "";

  // Admin only: list soft-deleted members instead of active ones
  const showDeleted = searchParams.deleted === "1" && can(s.role, "restore");
  // deceased members whose date of death is missing (link from the dashboard alert)
  const onlyNoDod = searchParams.nodod === "1" && !showDeleted;
  // Admin and Operator: members who moved out (on their own or with the family); hidden everywhere else
  const showMoved = searchParams.moved === "1" && can(s.role, "approve") && !showDeleted && !onlyNoDod;
  const all = await loadMembers(showDeleted ? "deleted" : onlyNoDod ? "nodod" : showMoved ? "moved" : "normal");
  // missing-data lists (Aadhaar, photo, age & DOB): only on the normal list of living members
  const normalList = !showDeleted && !showMoved && !onlyNoDod;
  const gap = normalList ? asGap(searchParams.gap) : null;
  const gapCounts = normalList ? Object.fromEntries(GAPS.map((g) => [g, all.filter((m) => hasGap(m, g)).length])) as Record<Gap, number> : null;
  const filtered = filterMembers(all, { q, blood, gap });
  const count = shownCount(searchParams.n, filtered.length);
  const shown = filtered.slice(0, count);
  const params = { q, blood, deleted: showDeleted ? "1" : undefined, nodod: onlyNoDod ? "1" : undefined, moved: showMoved ? "1" : undefined, gap: gap ?? undefined };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title">{gap ? t[`list_${gap}`] : t.members} <span className="text-stone-500 text-base">({filtered.length})</span></h1>
        {can(s.role, "export") && !showDeleted && (
          <DownloadButton {...downloadProps("members", t, lang, { q, blood, gap, memberMode: onlyNoDod ? "nodod" : showMoved ? "moved" : "normal" })} />
        )}
      </div>
      <SearchBox
        keep={{ gap, nodod: onlyNoDod ? "1" : undefined, moved: showMoved ? "1" : undefined, deleted: showDeleted ? "1" : undefined }}
        q={q}
        placeholder={t.searchPlaceholder}
        label={t.search}
        extra={
          <select name="blood" defaultValue={blood} className="input w-24">
            <option value="">{t.bloodGroup}</option>
            {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((x) => <option key={x}>{x}</option>)}
          </select>
        }
      />
      {gapCounts && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {GAPS.map((g) => (
            <Link key={g} href={gap === g ? "/members" : `/members?gap=${g}`} className={gap === g ? "badge-red font-semibold ring-1 ring-red-300" : "badge-red opacity-70 hover:opacity-100"}>
              {t[g]} · {gapCounts[g]}
            </Link>
          ))}
          {gap && <span className="text-xs text-stone-500">{t.gapHelp} <Link href="/members" className="underline">{t.showActive}</Link></span>}
        </div>
      )}
      {(can(s.role, "restore") || can(s.role, "approve")) && (
        <div className="flex gap-2 text-sm">
          {can(s.role, "approve") && (
            <Link href={showMoved ? "/members" : "/members?moved=1"} className={showMoved ? "badge-amber font-semibold" : "badge-amber opacity-60"}>
              {showMoved ? t.showActive : t.MOVED_OUT}
            </Link>
          )}
          {can(s.role, "restore") && (
            <Link href={showDeleted ? "/members" : "/members?deleted=1"} className={showDeleted ? "badge-red font-semibold" : "badge-red opacity-60"}>
              {showDeleted ? t.showActive : t.showDeleted}
            </Link>
          )}
        </div>
      )}
      {onlyNoDod && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <span>{t.missingDod}: {t.missingDodAlert}.</span>
          <Link href="/members" className="underline">{t.showActive}</Link>
        </div>
      )}
      {filtered.length === 0 && <p className="text-stone-500">{t.noResults}</p>}
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>{t.name}</th>
              <th>{t.age}</th>
              <th>{t.relation}</th>
              <th>{t.mobile}</th>
              <th>{t.bloodGroup}</th>
              <th>{t.familyCode}</th>
              {showDeleted && <th>{t.deletedOn}</th>}
              {showDeleted && <th />}
            </tr>
          </thead>
          <tbody>
            {shown.map((m) => (
              <tr key={m.id}>
                <td><Link href={`/families/${m.family.id}`} className="text-brand-700">{memberFullName(m, true, en)}</Link></td>
                <td>{currentAge(m) ?? ""}</td>
                <td>{relationLabel(m.relation, lang)}</td>
                <td>{m.mobile && <a href={`tel:${m.mobile}`}>{m.mobile}</a>}</td>
                <td>{m.bloodGroup}</td>
                <td className="whitespace-nowrap">{m.family.code}</td>
                {showDeleted && <td className="whitespace-nowrap">{m.deletedAt?.toLocaleDateString("en-IN")}</td>}
                {showDeleted && (
                  <td>
                    {m.family.deletedAt ? (
                      <span className="text-xs text-stone-500">{t.restoreFamilyFirst}</span>
                    ) : (
                      <form action={restoreMember}>
                        <input type="hidden" name="memberId" value={m.id} />
                        <button className="btn-secondary btn-sm">{t.restore}</button>
                      </form>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <LoadMore shown={count} total={filtered.length} nextHref={moreHref(params, count + STEP)} t={{ more: t.loadMore, loading: t.loadingMore, shownOf: t.shownOf }} />
    </div>
  );
}

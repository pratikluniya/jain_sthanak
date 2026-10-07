import { MISSING_DOD_WHERE } from "@/lib/deceased";
import Link from "next/link";
import DownloadButton from "@/components/DownloadButton";
import { downloadProps } from "@/lib/downloadProps";
import { prisma } from "@/lib/db";
import { getDict, getLang } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import { matchesSearch } from "@/lib/normalize";
import { relationLabel } from "@/lib/relations";
import { memberFullName, sortBySurname } from "@/lib/members";
import SearchBox from "@/components/SearchBox";
import { can } from "@/lib/rbac";
import { restoreMember } from "../families/actions";

export const dynamic = "force-dynamic";
const PAGE = 100;

export default async function MembersPage({ searchParams }: { searchParams: { q?: string; blood?: string; page?: string; deleted?: string; nodod?: string } }) {
  const s = await requireSession("view");
  const t = getDict();
  const lang = getLang();
  const en = lang === "en";
  const q = (searchParams.q ?? "").trim();
  const blood = searchParams.blood ?? "";
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);

  // Admin only: list soft-deleted members instead of active ones
  const showDeleted = searchParams.deleted === "1" && can(s.role, "restore");
  // deceased members whose date of death is missing (link from the dashboard alert)
  const onlyNoDod = searchParams.nodod === "1" && !showDeleted;
  const all = await prisma.member.findMany({
    where: onlyNoDod ? MISSING_DOD_WHERE : { deletedAt: showDeleted ? { not: null } : null },
    include: { family: { select: { id: true, code: true, deletedAt: true } } },
  });
  const filtered = sortBySurname(
    all
      .filter((m) => (!q || matchesSearch(m.searchKey, q)) && (!blood || m.bloodGroup === blood))
      .map((m) => ({ member: m })),
  ).map((r) => r.member);
  const shown = filtered.slice((page - 1) * PAGE, page * PAGE);
  const qs = (p: number) => `?${new URLSearchParams({ q, blood, page: String(p), ...(showDeleted ? { deleted: "1" } : {}), ...(onlyNoDod ? { nodod: "1" } : {}) })}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title">{t.members} <span className="text-stone-500 text-base">({filtered.length})</span></h1>
        {can(s.role, "export") && !showDeleted && <DownloadButton {...downloadProps("members", t, lang)} />}
      </div>
      <SearchBox
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
      {can(s.role, "restore") && (
        <div className="flex gap-2 text-sm">
          <Link href={showDeleted ? "/members" : "/members?deleted=1"} className={showDeleted ? "badge-red font-semibold" : "badge-red opacity-60"}>
            {showDeleted ? t.showActive : t.showDeleted}
          </Link>
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
                <td>{m.age ?? ""}</td>
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
      {filtered.length > PAGE && (
        <div className="flex gap-2 justify-center">
          {page > 1 && <Link className="btn-secondary btn-sm" href={qs(page - 1)}>←</Link>}
          <span className="text-sm self-center">{page} / {Math.ceil(filtered.length / PAGE)}</span>
          {page * PAGE < filtered.length && <Link className="btn-secondary btn-sm" href={qs(page + 1)}>→</Link>}
        </div>
      )}
    </div>
  );
}

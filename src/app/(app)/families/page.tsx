import Link from "next/link";
import { prisma } from "@/lib/db";
import { getDict, getLang } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { matchesSearch, searchKey } from "@/lib/normalize";
import { collator, headLabel } from "@/lib/members";
import SearchBox from "@/components/SearchBox";

export const dynamic = "force-dynamic";

export default async function FamiliesPage({ searchParams }: { searchParams: { q?: string; panth?: string } }) {
  const s = await requireSession("view");
  const t = getDict();
  const lang = getLang();
  const en = lang === "en";
  const q = (searchParams.q ?? "").trim();
  const onlyToVerify = searchParams.panth === "TO_VERIFY";

  const families = await prisma.family.findMany({
    where: onlyToVerify ? { panthStatus: "TO_VERIFY" } : undefined,
    include: { members: { select: { searchKey: true, mobile: true } } },
  });

  const filtered = families
    .filter((f) => {
      if (!q) return true;
      const key = [searchKey(f.headName), searchKey(f.headNameEn), searchKey(f.address), f.code.toLowerCase(), ...f.members.map((m) => m.searchKey)].join(" | ");
      return matchesSearch(key, q) || f.code.toLowerCase().includes(q.toLowerCase());
    })
    .sort((a, b) => collator.compare(a.code, b.code));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">{t.families} <span className="text-stone-500 text-base">({filtered.length})</span></h1>
        {can(s.role, "edit") && <Link href="/families/new" className="btn-primary btn-sm">+ {t.addFamily}</Link>}
      </div>
      <SearchBox q={q} placeholder={t.searchPlaceholder} label={t.search} />
      <div className="flex gap-2 text-sm">
        <Link href="/families" className={!onlyToVerify ? "badge-gray font-semibold" : "badge-gray opacity-60"}>{t.total}</Link>
        <Link href="/families?panth=TO_VERIFY" className={onlyToVerify ? "badge-amber font-semibold" : "badge-amber opacity-60"}>{t.toVerify}</Link>
      </div>
      {filtered.length === 0 && <p className="text-stone-500">{t.noResults}</p>}
      <ul className="grid gap-2 sm:grid-cols-2">
        {filtered.map((f) => (
          <li key={f.id}>
            <Link href={`/families/${f.id}`} className="card p-3 block hover:border-brand-500">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{headLabel(f, en) || "?"}</div>
                  <div className="text-xs text-stone-500 truncate">{f.address}</div>
                </div>
                <span className="badge-gray shrink-0 whitespace-nowrap">{f.code}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1 text-xs">
                <span className="badge-gray">{t.members}: {f.members.length}</span>
                {f.panthStatus === "CONFIRMED" ? (
                  <span className={f.panth === "STHANAKVASI" ? "badge-green" : "badge-gray"}>{t[f.panth]}</span>
                ) : (
                  <span className="badge-amber">{t.panth}: {t.toVerify}</span>
                )}
                {f.status !== "ACTIVE" && <span className="badge-red">{t[f.status]}</span>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

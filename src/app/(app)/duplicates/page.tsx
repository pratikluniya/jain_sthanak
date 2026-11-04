// Duplicate report (24 Oct 2026): likely duplicates in the live data, for Admin and Operator to check.
// Nothing is changed here; each pair links to both family pages.
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getDict } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import { LIVE } from "@/lib/softDelete";
import { findDuplicates, type DupKind, type DupSide } from "@/lib/duplicates";
import LoadMore from "@/components/LoadMore";
import { moreHref, shownCount, STEP } from "@/lib/listPaging";

export const dynamic = "force-dynamic";

const KINDS: DupKind[] = ["SAME_FAMILY_TWICE", "SAME_PERSON_2_FAMILIES", "SAME_PERSON_IN_FAMILY", "SHARED_MOBILE"];

export default async function DuplicatesPage({ searchParams }: { searchParams: { kind?: string; n?: string } }) {
  await requireSession("approve");
  const t = getDict();
  const families = await prisma.family.findMany({
    where: { ...LIVE, status: { not: "MOVED_OUT" } },
    select: {
      id: true, code: true, headName: true, address: true,
      members: { where: { ...LIVE, status: { not: "MOVED_OUT" } }, select: { id: true, firstName: true, middleName: true, surname: true, firstNameEn: true, surnameEn: true, mobile: true } },
    },
    orderBy: { code: "asc" },
  });
  const pairs = findDuplicates(families);
  const kind = (KINDS as string[]).includes(searchParams.kind ?? "") ? (searchParams.kind as DupKind) : KINDS.find((x) => pairs.some((p) => p.kind === x)) ?? KINDS[0];
  const ofKind = pairs.filter((p) => p.kind === kind);
  const n = shownCount(searchParams.n, ofKind.length);
  const shown = ofKind.slice(0, n);
  const count = (x: DupKind) => pairs.filter((p) => p.kind === x).length;
  const Side = ({ s }: { s: DupSide }) => (
    <Link href={`/families/${s.familyId}`} className="block min-w-0 flex-1 rounded-lg border border-stone-200 p-2 hover:border-brand-300">
      <span className="badge-gray">{s.code}</span> <span className="text-sm text-stone-600">{s.headName}</span>
      {s.name && <span className="mt-0.5 block font-semibold text-brand-700">{s.name}</span>}
    </Link>
  );

  return (
    <div className="space-y-3">
      <h1 className="page-title">{t.dup_title}</h1>
      <p className="text-sm text-stone-600">{t.dup_intro}</p>
      <div className="flex flex-wrap gap-2">
        {KINDS.map((x) => (
          <Link key={x} href={`?kind=${x}`} className={x === kind ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>
            {t[`dup_${x}`]} ({count(x)})
          </Link>
        ))}
      </div>
      <p className="text-xs text-stone-500">{t[`dup_${kind}_help`]}</p>
      {shown.length === 0 ? (
        <p className="text-sm text-stone-500">{t.dup_none}</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((p, i) => (
            <li key={i} className="card p-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Side s={p.a} />
                <Side s={p.b} />
              </div>
              {p.why.length > 0 && <p className="mt-1 text-xs text-stone-500">{t.dup_why}: {p.why.join(", ")}</p>}
            </li>
          ))}
        </ul>
      )}
      <LoadMore shown={n} total={ofKind.length} nextHref={moreHref({ kind }, n + STEP)} t={{ more: t.loadMore, loading: t.loadingMore, shownOf: t.shownOf }} />
    </div>
  );
}

// Yearly donations screen (23 Oct 2026): pick a donation and year, see who paid, who is exempt and who
// has not paid, the totals, and record payments. Admin sets the year's amount here.
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getDict, getLang } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { matchesSearch, searchKey } from "@/lib/normalize";
import { collator, headLabel } from "@/lib/members";
import SearchBox from "@/components/SearchBox";
import { DONATION_KINDS, DUE_FAMILY, FIRST_DONATION_YEAR, asKind, currentYear, rupees, yearSummary } from "@/lib/donations";
import EntryControls, { EntryDetails, StatusBadge } from "./EntryControls";
import { setYearAmountAction } from "./actions";

export const dynamic = "force-dynamic";

const SHOWS = ["UNPAID", "PAID", "EXEMPT", "ALL"] as const;
type Show = (typeof SHOWS)[number];
const PAGE = 100;

export default async function DonationsPage({ searchParams }: { searchParams: { kind?: string; year?: string; show?: string; q?: string; page?: string } }) {
  const s = await requireSession("view");
  const t = getDict();
  const en = getLang() === "en";
  const canRecord = can(s.role, "edit");
  const canAdmin = can(s.role, "donationAdmin");
  const kind = asKind(searchParams.kind);
  const thisYear = currentYear();
  const lastYear = Math.max(thisYear, (await prisma.donationYear.aggregate({ _max: { year: true } }))._max.year ?? thisYear);
  const yearReq = parseInt(searchParams.year ?? "", 10);
  const year = yearReq >= FIRST_DONATION_YEAR && yearReq <= lastYear + 1 ? yearReq : thisYear;
  const show: Show = (SHOWS as readonly string[]).includes(searchParams.show ?? "") ? (searchParams.show as Show) : "UNPAID";
  const q = (searchParams.q ?? "").trim();
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);

  const [sum, families] = await Promise.all([
    yearSummary(kind, year),
    prisma.family.findMany({
      where: DUE_FAMILY,
      select: {
        id: true, code: true, headName: true, headNameEn: true,
        members: { where: { deletedAt: null, status: "ACTIVE" }, select: { mobile: true, searchKey: true, isHead: true }, orderBy: [{ isHead: "desc" }, { serial: "asc" }] },
        donations: { where: { kind, year } },
      },
    }),
  ]);
  const open = sum.amount !== null && year <= thisYear;

  const rows = families
    .map((f) => ({ f, entry: f.donations[0] ?? null }))
    .filter(({ entry }) => show === "ALL" || (show === "UNPAID" ? !entry : entry?.status === show))
    .filter(({ f }) => {
      if (!q) return true;
      const key = [searchKey(f.headName), searchKey(f.headNameEn), f.code.toLowerCase(), ...f.members.map((m) => m.searchKey)].join(" | ");
      return matchesSearch(key, q) || f.code.toLowerCase().includes(q.toLowerCase());
    })
    .sort((a, b) => collator.compare(a.f.code, b.f.code));
  const shown = rows.slice((page - 1) * PAGE, page * PAGE);

  const userIds = [...new Set(shown.map((r) => r.entry?.updatedById ?? r.entry?.createdById).filter((x): x is string => !!x))];
  const names = new Map((await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));

  const qs = (over: Record<string, string | number>) =>
    `?${new URLSearchParams({ kind, year: String(year), show, ...(q ? { q } : {}), ...Object.fromEntries(Object.entries(over).map(([k, v]) => [k, String(v)])) })}`;
  const years: number[] = [];
  for (let y = lastYear + (canAdmin ? 1 : 0); y >= FIRST_DONATION_YEAR; y--) years.push(y);
  const count = { UNPAID: sum.unpaid, PAID: sum.paid, EXEMPT: sum.exempt, ALL: sum.due };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title">{t.donations}</h1>
        <Link href="/donations/arrears" className="btn-secondary">{t.arrears} →</Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {DONATION_KINDS.map((k) => (
          <Link key={k} href={qs({ kind: k, page: 1 })} className={k === kind ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>{t[k]}</Link>
        ))}
        <span className="mx-1 text-stone-300">|</span>
        {years.map((y) => (
          <Link key={y} href={qs({ year: y, page: 1 })} className={y === year ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>{y}</Link>
        ))}
      </div>

      <section className="card grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-4">
        <div>
          <div className="text-xs font-semibold text-stone-500">{t.donationAmount}</div>
          <div className="font-heading text-lg font-semibold">{sum.amount !== null ? rupees(sum.amount) : "—"}</div>
        </div>
        <div>
          <div className="text-xs font-semibold text-stone-500">{t.dueFamilies}</div>
          <div className="font-heading text-lg font-semibold">{sum.due}</div>
        </div>
        <div>
          <div className="text-xs font-semibold text-stone-500">{t.collected} / {t.expected}</div>
          <div className="font-heading text-lg font-semibold">{rupees(sum.collected)} / {rupees(sum.expected)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold text-stone-500">{t.PAID} · {t.EXEMPT} · {t.UNPAID}</div>
          <div className="font-heading text-lg font-semibold">{sum.paid} · {sum.exempt} · <span className={open && sum.unpaid ? "text-red-700" : ""}>{open ? sum.unpaid : "—"}</span></div>
        </div>
        {canAdmin && (
          <form action={setYearAmountAction} className="col-span-2 flex flex-wrap items-end gap-2 sm:col-span-4">
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="year" value={year} />
            <label className="text-xs">
              {t[kind]} {year}: {t.donationAmount} (₹)
              <input className="input w-36" name="amount" inputMode="numeric" required defaultValue={sum.amount ?? ""} />
            </label>
            <button className="btn-secondary btn-sm">{t.setAmount}</button>
          </form>
        )}
      </section>

      {sum.amount === null ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{t.donationNotSet}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 text-sm">
            {SHOWS.map((sh) => (
              <Link key={sh} href={qs({ show: sh, page: 1 })} className={sh === show ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>
                {t[sh]} ({count[sh]})
              </Link>
            ))}
          </div>
          <SearchBox
            q={q}
            placeholder={t.searchPlaceholder}
            label={t.search}
            extra={<><input type="hidden" name="kind" value={kind} /><input type="hidden" name="year" value={year} /><input type="hidden" name="show" value={show} /></>}
          />
          {shown.length === 0 && <p className="text-sm text-stone-500">{t.noFamiliesHere}</p>}
          <ul className="card divide-y">
            {shown.map(({ f, entry }) => {
              const mobile = f.members.find((m) => m.mobile)?.mobile;
              return (
                <li key={f.id} className="space-y-1 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge-gray">{f.code}</span>
                    <Link href={`/families/${f.id}`} className="font-semibold text-brand-700">{headLabel(f, en)}</Link>
                    {mobile && <a href={`tel:${mobile}`} className="text-sm text-stone-600">{mobile}</a>}
                    <StatusBadge entry={entry} t={t} />
                  </div>
                  {entry && <EntryDetails entry={entry} t={t} by={names.get(entry.updatedById ?? entry.createdById ?? "")} />}
                  {open && (
                    <EntryControls
                      familyId={f.id} kind={kind} year={year} amount={sum.amount!} entry={entry}
                      canRecord={canRecord} canAdmin={canAdmin} t={t} label={`${f.code} · ${t[kind]} ${year}`}
                    />
                  )}
                </li>
              );
            })}
          </ul>
          {rows.length > PAGE && (
            <div className="flex gap-2">
              {page > 1 && <Link className="btn-secondary btn-sm" href={qs({ page: page - 1 })}>←</Link>}
              <span className="self-center text-sm">{page} / {Math.ceil(rows.length / PAGE)}</span>
              {page * PAGE < rows.length && <Link className="btn-secondary btn-sm" href={qs({ page: page + 1 })}>→</Link>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

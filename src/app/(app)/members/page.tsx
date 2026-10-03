import Link from "next/link";
import { prisma } from "@/lib/db";
import { getDict, getLang } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import { matchesSearch } from "@/lib/normalize";
import { relationLabel } from "@/lib/relations";
import { memberFullName, sortBySurname } from "@/lib/members";
import SearchBox from "@/components/SearchBox";

export const dynamic = "force-dynamic";
const PAGE = 100;

export default async function MembersPage({ searchParams }: { searchParams: { q?: string; blood?: string; page?: string } }) {
  await requireSession("view");
  const t = getDict();
  const lang = getLang();
  const en = lang === "en";
  const q = (searchParams.q ?? "").trim();
  const blood = searchParams.blood ?? "";
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);

  const all = await prisma.member.findMany({ include: { family: { select: { id: true, code: true } } } });
  const filtered = sortBySurname(
    all
      .filter((m) => (!q || matchesSearch(m.searchKey, q)) && (!blood || m.bloodGroup === blood))
      .map((m) => ({ member: m })),
  ).map((r) => r.member);
  const shown = filtered.slice((page - 1) * PAGE, page * PAGE);
  const qs = (p: number) => `?${new URLSearchParams({ q, blood, page: String(p) })}`;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">{t.members} <span className="text-stone-500 text-base">({filtered.length})</span></h1>
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

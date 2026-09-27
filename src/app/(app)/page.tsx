import Link from "next/link";
import { prisma } from "@/lib/db";
import { getDict } from "@/lib/i18n";
import { evaluateAll } from "@/lib/members";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const s = await requireSession("view");
  const t = getDict();
  const [families, members, toVerify, pendingUploads, { rows, electionDate, electionDateSet }] = await Promise.all([
    prisma.family.count(),
    prisma.member.count(),
    prisma.family.count({ where: { panthStatus: "TO_VERIFY" } }),
    prisma.formUpload.count({ where: { status: "EXTRACTED" } }),
    evaluateAll(),
  ]);
  const voters = rows.filter((r) => r.result.eligible).length;
  const borderline = rows.filter((r) => r.result.reasons.includes("AGE_BORDERLINE")).length;

  const stats = [
    { label: t.stats_families, value: families, href: "/families" },
    { label: t.stats_members, value: members, href: "/members" },
    { label: t.stats_voters, value: voters, href: "/voters" },
    { label: t.stats_toVerify, value: toVerify, href: "/families?panth=TO_VERIFY", warn: toVerify > 0 },
    { label: t.stats_pendingUploads, value: pendingUploads, href: "/upload", warn: pendingUploads > 0 },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {stats.map((st) => (
          <Link key={st.label} href={st.href} className={`card p-4 hover:border-brand-500 ${st.warn ? "border-amber-300 bg-amber-50" : ""}`}>
            <div className="text-3xl font-bold text-brand-900">{st.value}</div>
            <div className="text-sm text-stone-600">{st.label}</div>
          </Link>
        ))}
      </div>
      <div className="card p-4 text-sm space-y-1">
        <div>
          <b>{t.electionDate}:</b> {electionDateSet ? electionDate.toLocaleDateString("en-IN") : <span className="text-amber-700">{t.electionDateNotSet}</span>}
        </div>
        {borderline > 0 && (
          <div className="text-amber-700">
            {t.AGE_BORDERLINE}: {borderline}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {can(s.role, "upload") && <Link href="/upload" className="btn-primary">{t.uploadForm}</Link>}
        {can(s.role, "edit") && <Link href="/families/new" className="btn-secondary">{t.addFamily}</Link>}
        <Link href="/voters" className="btn-secondary">{t.voterList}</Link>
      </div>
    </div>
  );
}

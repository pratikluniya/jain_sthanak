import Link from "next/link";
import { prisma } from "@/lib/db";
import { getDict } from "@/lib/i18n";
import { evaluateAll } from "@/lib/members";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import Icon, { type IconName } from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const s = await requireSession("view");
  const t = getDict();
  const [families, members, toVerify, pendingUploads, { rows, ageDate, electionDate }] = await Promise.all([
    prisma.family.count(),
    prisma.member.count(),
    prisma.family.count({ where: { panthStatus: "TO_VERIFY" } }),
    prisma.formUpload.count({ where: { status: "EXTRACTED" } }),
    evaluateAll(),
  ]);
  const voters = rows.filter((r) => r.result.eligible).length;
  const borderline = rows.filter((r) => r.result.reasons.includes("AGE_BORDERLINE")).length;

  const stats: { label: string; value: number; href: string; icon: IconName; warn?: boolean }[] = [
    { label: t.stats_families, value: families, href: "/families", icon: "families" },
    { label: t.stats_members, value: members, href: "/members", icon: "member" },
    { label: t.stats_voters, value: voters, href: "/voters", icon: "voters" },
    { label: t.stats_toVerify, value: toVerify, href: "/families?panth=TO_VERIFY", icon: "families", warn: toVerify > 0 },
    { label: t.stats_pendingUploads, value: pendingUploads, href: "/upload", icon: "upload", warn: pendingUploads > 0 },
  ];

  return (
    <div className="space-y-5">
      <h1 className="page-title">{t.dashboard}</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((st) => (
          <Link
            key={st.label}
            href={st.href}
            className={`card group p-4 transition hover:-translate-y-0.5 hover:shadow-md ${st.warn ? "border-amber-300 bg-amber-50" : "hover:border-brand-200"}`}
          >
            <span className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${st.warn ? "bg-amber-100 text-amber-700" : "bg-brand-50 text-brand-700"}`}>
              <Icon name={st.icon} />
            </span>
            <div className="font-heading text-3xl font-bold leading-none text-stone-900">{st.value}</div>
            <div className="mt-1 text-sm text-stone-600">{st.label}</div>
          </Link>
        ))}
      </div>
      <div className="card grid gap-4 p-4 text-sm sm:grid-cols-2">
        <div>
          <div className="text-xs font-semibold text-stone-500">{t.ageCutoffDate}</div>
          <div className="mt-0.5 font-heading text-lg font-semibold">{ageDate.toLocaleDateString("en-IN")}</div>
        </div>
        <div>
          <div className="text-xs font-semibold text-stone-500">{t.electionDate}</div>
          <div className="mt-0.5 font-heading text-lg font-semibold">
            {electionDate ? electionDate.toLocaleDateString("en-IN") : <span className="text-amber-700">{t.electionDateNotSet}</span>}
          </div>
        </div>
        {borderline > 0 && (
          <div className="text-amber-700 sm:col-span-2">
            {t.AGE_BORDERLINE}: {borderline}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {can(s.role, "upload") && <Link href="/upload" className="btn-primary"><Icon name="upload" className="h-4 w-4" />{t.uploadForm}</Link>}
        {can(s.role, "edit") && <Link href="/families/new" className="btn-secondary"><Icon name="families" className="h-4 w-4" />{t.addFamily}</Link>}
        <Link href="/voters" className="btn-secondary"><Icon name="voters" className="h-4 w-4" />{t.voterList}</Link>
      </div>
    </div>
  );
}

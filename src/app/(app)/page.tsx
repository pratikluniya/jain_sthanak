import Link from "next/link";
import { prisma } from "@/lib/db";
import { getDict } from "@/lib/i18n";
import { evaluateAll } from "@/lib/members";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { LIVE } from "@/lib/softDelete";
import Icon, { type IconName } from "@/components/Icon";
import DemiseReminder from "@/components/DemiseReminder";
import { DEMISE_EVERY_DAYS, demiseReminderDue, todayIST } from "@/lib/deceased";
import { deceasedLabels } from "@/lib/deceasedLabels";
import { memberFullName } from "@/lib/members";
import { getLang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const s = await requireSession("view");
  const t = getDict();
  const [families, members, toVerify, pendingUploads, { rows, ageDate, electionDate }] = await Promise.all([
    prisma.family.count({ where: LIVE }),
    prisma.member.count({ where: LIVE }),
    prisma.family.count({ where: { ...LIVE, panthStatus: "TO_VERIFY" } }),
    prisma.formUpload.count({ where: { status: "EXTRACTED" } }),
    evaluateAll(),
  ]);
  const voters = rows.filter((r) => r.result.eligible).length;

  // 15-day demise reminder for Admin and Operator
  let reminder: React.ReactNode = null;
  if (can(s.role, "approve")) {
    const me = await prisma.user.findUnique({ where: { id: s.uid }, select: { demiseCheckDoneAt: true, demiseSnoozeUntil: true } });
    if (me && demiseReminderDue(me)) {
      const en = getLang() === "en";
      const since = new Date(Date.now() - DEMISE_EVERY_DAYS * 86_400_000);
      const recent = await prisma.member.findMany({
        where: { ...LIVE, status: "DECEASED", deceasedMarkedAt: { gte: since } },
        include: { family: { select: { code: true } } },
        orderBy: { deceasedMarkedAt: "desc" },
      });
      const userIds = [...new Set(recent.map((r) => r.deceasedMarkedById).filter((x): x is string => !!x))];
      const names = new Map((await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
      reminder = (
        <DemiseReminder
          english={en}
          today={todayIST()}
          recent={recent.map((r) => ({
            id: r.id,
            name: memberFullName(r, true, en),
            familyCode: r.family.code,
            dateOfDeath: r.dateOfDeath ? r.dateOfDeath.toLocaleDateString("en-IN") : null,
            markedBy: (r.deceasedMarkedById && names.get(r.deceasedMarkedById)) || "—",
          }))}
          t={{
            ...deceasedLabels(t), demiseTitle: t.demiseTitle, demiseIntro: t.demiseIntro, demiseRecent: t.demiseRecent, demiseNone: t.demiseNone,
            markedBy: t.markedBy, searchMember: t.searchMember, demiseDone: t.demiseDone, demiseLater: t.demiseLater, markedDone: t.markedDone,
            family: t.family, isHead: t.isHead, name: t.name,
          }}
        />
      );
    }
  }
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
      {reminder}
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

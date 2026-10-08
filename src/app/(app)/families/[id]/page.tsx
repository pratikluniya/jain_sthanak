import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getDict, getLang } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { relationLabel } from "@/lib/relations";
import { checkVoter } from "@/lib/eligibility";
import { effectiveAgeDate, getSettings } from "@/lib/settings";
import { memberFullName, headLabel } from "@/lib/members";
import { approveKyc, confirmPanth, deleteFamily, deleteMember, restoreFamily } from "../actions";
import { RECEIPTS_ENABLED } from "@/lib/features";
import { initials } from "@/lib/initials";
import MarkDeceasedButton from "@/components/MarkDeceasedButton";
import MoveOutButton from "@/components/MoveOutButton";
import { undoFamilyMovedOutAction, undoMemberMovedOutAction } from "../../movedOutActions";
import { deceasedLabels, moveLabels } from "@/lib/deceasedLabels";
import { todayIST } from "@/lib/deceased";
import { undoDeceasedAction } from "../../deceasedActions";
import { LIVE } from "@/lib/softDelete";
import ConfirmButton from "@/components/ConfirmButton";
import { formImageUrls } from "@/lib/storage";
import ApplicationSummary from "@/components/ApplicationSummary";

export const dynamic = "force-dynamic";

export default async function FamilyPage({ params }: { params: { id: string } }) {
  const s = await requireSession("view");
  const t = getDict();
  const lang = getLang();
  const en = lang === "en";
  const fam = await prisma.family.findUnique({
    where: { id: params.id },
    include: {
      members: { orderBy: [{ isHead: "desc" }, { serial: "asc" }], include: { application: true } },
      uploads: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { date: "desc" } },
      parentFamily: true,
      linkedFamilies: { where: LIVE },
    },
  });
  if (!fam) notFound();
  const deleted = !!fam.deletedAt;
  // moved-out families and members are seen only by Admin and Operator (who can undo)
  const seesMoved = can(s.role, "approve");
  const familyMoved = fam.status === "MOVED_OUT";
  if (familyMoved && !seesMoved) notFound();
  // live family: its live members; deleted family (Admin view): the members deleted together with it
  const members = fam.members
    .filter((m) => (deleted ? m.deletedAt?.getTime() === fam.deletedAt!.getTime() : !m.deletedAt))
    .filter((m) => seesMoved || m.status !== "MOVED_OUT");
  if (deleted && !can(s.role, "restore")) notFound();
  const deletedBy = fam.deletedById ? await prisma.user.findUnique({ where: { id: fam.deletedById }, select: { name: true } }) : null;
  // a deleted family is read-only until it is restored
  const canEdit = can(s.role, "edit") && !deleted;
  const canDelete = can(s.role, "delete") && !deleted;
  const canMarkDeceased = can(s.role, "approve") && !deleted && !familyMoved;
  const dLabels = deceasedLabels(t);
  const mLabels = moveLabels(t);
  const today = todayIST();
  const living = members.filter((x) => x.status !== "DECEASED" && x.status !== "MOVED_OUT");
  const movedBy = fam.movedOutMarkedById ? await prisma.user.findUnique({ where: { id: fam.movedOutMarkedById }, select: { name: true } }) : null;
  const settings = await getSettings();
  const ageDate = effectiveAgeDate(settings);
  const allKeys = fam.uploads.flatMap((u) => u.imageKeys);
  const urls = await formImageUrls(allKeys);
  const urlOf = new Map(allKeys.map((k, i) => [k, urls[i]]));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/families" className="text-brand-700">← {t.families}</Link>
      </div>

      {deleted && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <span>
            <b>{t.deletedTag}</b> · {fam.deletedAt!.toLocaleDateString("en-IN")}
            {deletedBy && ` · ${deletedBy.name}`}. {t.familyDeletedNote}
          </span>
          <form action={restoreFamily}>
            <input type="hidden" name="id" value={fam.id} />
            <button className="btn-primary btn-sm">{t.restore}</button>
          </form>
        </div>
      )}

      {familyMoved && !deleted && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <span>
            <b>{t.MOVED_OUT}</b>
            {fam.movedOutOn && ` · ${fam.movedOutOn.toLocaleDateString("en-IN")}`}
            {fam.movedOutCity && ` · ${fam.movedOutCity}`}
            {fam.movedOutRemark && ` · ${fam.movedOutRemark}`}
            {movedBy && ` · ${movedBy.name}`}. {t.familyMovedNote}
          </span>
          <form action={undoFamilyMovedOutAction}>
            <input type="hidden" name="familyId" value={fam.id} />
            <ConfirmButton className="btn-secondary btn-sm" message={`${fam.code}: ${t.undoMovedConfirm}`}>{t.undoMovedOut}</ConfirmButton>
          </form>
        </div>
      )}

      <section className="card p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="page-title">{headLabel(fam, en)}</h1>
            <p className="text-stone-600 text-sm">{fam.address}</p>
            {fam.area && <p className="text-stone-500 text-xs">{t.area}: {fam.area}</p>}
          </div>
          <span className="badge-gray text-sm whitespace-nowrap">{fam.code}</span>
        </div>
        <div className="flex flex-wrap gap-2 items-center text-sm">
          <b>{t.panth}:</b>
          {fam.panthStatus === "CONFIRMED" ? (
            <span className={fam.panth === "STHANAKVASI" ? "badge-green" : "badge-gray"}>{t[fam.panth]}</span>
          ) : (
            <span className="badge-amber">{fam.panth !== "UNKNOWN" ? `${t[fam.panth]} · ` : ""}{t.toVerify}</span>
          )}
          {fam.status !== "ACTIVE" && <span className="badge-red">{t[fam.status]}</span>}
        </div>
        {fam.panthStatus === "TO_VERIFY" && can(s.role, "approve") && !deleted && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <p className="text-sm mb-2">{t.confirmPanth}:</p>
            <form action={confirmPanth} className="flex flex-wrap gap-2">
              <input type="hidden" name="id" value={fam.id} />
              {(["STHANAKVASI", "MANDIRMARGI", "TERAPANTH", "DIGAMBAR"] as const).map((p) => (
                <button key={p} name="panth" value={p} className={p === "STHANAKVASI" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>{t[p]}</button>
              ))}
            </form>
          </div>
        )}
        {fam.notes && <p className="text-sm text-stone-600 whitespace-pre-wrap">{t.notes}: {fam.notes}</p>}
        {(fam.parentFamily || fam.linkedFamilies.length > 0) && (
          <div className="text-sm">
            {fam.parentFamily && <Link className="text-brand-700 underline" href={`/families/${fam.parentFamily.id}`}>↑ {fam.parentFamily.code} {headLabel(fam.parentFamily, en)}</Link>}
            {fam.linkedFamilies.map((l) => (
              <Link key={l.id} className="text-brand-700 underline mr-3" href={`/families/${l.id}`}>↳ {l.code} {headLabel(l, en)}</Link>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          {canEdit && <Link href={`/families/${fam.id}/edit`} className="btn-secondary btn-sm">{t.edit}</Link>}
          {canEdit && <Link href={`/families/${fam.id}/member`} className="btn-primary btn-sm">+ {t.addMember}</Link>}
          {RECEIPTS_ENABLED && !deleted && can(s.role, "receipts") && <Link href={`/receipts/new?family=${fam.id}`} className="btn-secondary btn-sm">+ {t.newReceipt}</Link>}
          {canMarkDeceased && <MoveOutButton target={{ familyId: fam.id, name: `${fam.code} · ${headLabel(fam, en)}` }} today={today} t={mLabels} />}
          {canDelete && (
            <form action={deleteFamily}>
              <input type="hidden" name="id" value={fam.id} />
              <ConfirmButton className="btn-danger btn-sm" message={`${fam.code}: ${t.deleteConfirmSoft}`}>{t.delete}</ConfirmButton>
            </form>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="section-title">{t.members} ({members.length})</h2>
        {members.map((m) => {
          const r = checkVoter(m, fam, { asOfDate: ageDate, applyStatusRules: settings.applyStatusRules });
          return (
            <div key={m.id} className="card p-3">
              <div className="flex items-start justify-between gap-2">
                {m.photoKey ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/files/photos/${m.photoKey}`} alt="" loading="lazy" className="h-14 w-12 shrink-0 rounded-lg border border-stone-200 object-cover" />
                ) : (
                  <span className="flex h-14 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-50 font-heading text-sm font-bold text-brand-700">{initials(memberFullName(m, false, en))}</span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">
                    {memberFullName(m, true, en)} {m.isHead && <span className="badge-gray ml-1">{t.isHead}</span>}
                  </div>
                  <div className="text-sm text-stone-600">
                    {relationLabel(m.relation, lang)}
                    {m.gender !== "UNKNOWN" && ` · ${t[m.gender]}`}
                    {m.age !== null && ` · ${t.age}: ${m.age}`}
                    {m.bloodGroup && ` · ${m.bloodGroup}`}
                  </div>
                  <div className="text-sm text-stone-600">
                    {[m.education, m.occupation].filter(Boolean).join(" · ")}
                  </div>
                  {m.mobile && <a href={`tel:${m.mobile}`} className="text-sm text-brand-700">{m.mobile}</a>}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0 text-xs">
                  {r.eligible ? (
                    <span className="badge-green">{t.eligible}{m.voterNo ? ` #${m.voterNo}` : ""}</span>
                  ) : (
                    r.reasons.filter((x) => x !== "DECEASED" && x !== "MOVED_OUT").map((x) => <span key={x} className={x === "UNDER_AGE" ? "badge-gray" : "badge-amber"}>{t[x]}</span>)
                  )}
                  {m.status !== "ACTIVE" && (
                    <span className="badge-red">{t[m.status]}{m.status === "DECEASED" && m.dateOfDeath ? ` · ${m.dateOfDeath.toLocaleDateString("en-IN")}` : ""}</span>
                  )}
                  {m.status === "DECEASED" && !m.dateOfDeath && <span className="badge-amber">⚠ {t.missingDod}</span>}
                  {m.aadhaarLast4 || m.kycFileKey || m.aadhaarBackKey ? (
                    m.kycVerified ? <span className="badge-green">{t.kycVerified}</span> : <span className="badge-amber">{t.kycPending}</span>
                  ) : null}
                </div>
              </div>
              {m.application && <ApplicationSummary a={m.application} t={t} editHref={canEdit ? `/families/${fam.id}/application?m=${m.id}` : undefined} />}
              <div className="mt-2 flex flex-wrap gap-2">
                {canEdit && <Link href={`/families/${fam.id}/member?m=${m.id}`} className="btn-secondary btn-sm">{t.edit}</Link>}
                {can(s.role, "approve") && !deleted && !m.kycVerified && (m.aadhaarLast4 || m.kycFileKey || m.aadhaarBackKey) && (
                  <form action={approveKyc}>
                    <input type="hidden" name="memberId" value={m.id} />
                    <button className="btn-secondary btn-sm">KYC {t.approve}</button>
                  </form>
                )}
                {can(s.role, "viewAadhaar") && m.kycFileKey && (
                  <a href={`/api/files/kyc/${m.kycFileKey}`} target="_blank" className="btn-secondary btn-sm">{m.kycDocType && m.kycDocType !== "AADHAAR" ? m.kycDocType : t.aadhaarFront} 📄</a>
                )}
                {can(s.role, "viewAadhaar") && m.aadhaarBackKey && (
                  <a href={`/api/files/kyc/${m.aadhaarBackKey}`} target="_blank" className="btn-secondary btn-sm">{t.aadhaarBack} 📄</a>
                )}
                {m.aadhaarLast4 && <span className="text-xs text-stone-500 self-center">{t.aadhaar}: XXXX XXXX {m.aadhaarLast4}</span>}
                {m.kycDocType && m.kycDocType !== "AADHAAR" && <span className="text-xs text-stone-500 self-center">KYC: {m.kycDocType}</span>}
                {m.dob && <span className="text-xs text-stone-500 self-center">{t.dob}: {m.dob.toLocaleDateString("en-IN")}</span>}
                {canMarkDeceased && m.status !== "DECEASED" && m.status !== "MOVED_OUT" && (
                  <MoveOutButton
                    target={{ memberId: m.id, name: memberFullName(m, true, en), isHead: m.isHead }}
                    others={living.filter((x) => x.id !== m.id).map((x) => ({ id: x.id, name: memberFullName(x, true, en) }))}
                    today={today}
                    t={mLabels}
                  />
                )}
                {seesMoved && m.status === "MOVED_OUT" && !familyMoved && !deleted && (
                  <form action={undoMemberMovedOutAction}>
                    <input type="hidden" name="memberId" value={m.id} />
                    <ConfirmButton className="btn-secondary btn-sm" message={`${memberFullName(m)}: ${t.undoMovedConfirm}`}>{t.undoMovedOut}</ConfirmButton>
                  </form>
                )}
                {m.status === "MOVED_OUT" && (m.movedOutOn || m.movedOutCity) && (
                  <span className="text-xs text-stone-500 self-center">
                    {t.movedOn}: {m.movedOutOn?.toLocaleDateString("en-IN")}{m.movedOutCity && ` · ${m.movedOutCity}`}{m.movedOutRemark && ` · ${m.movedOutRemark}`}
                  </span>
                )}
                {canMarkDeceased && m.status !== "DECEASED" && m.status !== "MOVED_OUT" && (
                  <MarkDeceasedButton
                    member={{ id: m.id, name: memberFullName(m, true, en), isHead: m.isHead }}
                    others={living.filter((x) => x.id !== m.id).map((x) => ({ id: x.id, name: memberFullName(x, true, en) }))}
                    today={today}
                    t={dLabels}
                  />
                )}
                {canMarkDeceased && m.status === "DECEASED" && (
                  <form action={undoDeceasedAction}>
                    <input type="hidden" name="memberId" value={m.id} />
                    <ConfirmButton className="btn-secondary btn-sm" message={`${memberFullName(m)}: ${t.undoConfirm}`}>{t.undoDeceased}</ConfirmButton>
                  </form>
                )}
                {canDelete && (
                  <form action={deleteMember}>
                    <input type="hidden" name="memberId" value={m.id} />
                    <ConfirmButton className="btn-sm text-red-600 underline" message={`${memberFullName(m)}: ${t.deleteConfirmSoft}`}>{t.delete}</ConfirmButton>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {fam.uploads.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-title">{t.upload}</h2>
          <div className="flex flex-wrap gap-2">
            {fam.uploads.flatMap((u) =>
              u.imageKeys.map((k, i) => (
                <a key={k} href={urlOf.get(k)} target="_blank" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={urlOf.get(k)} alt={`form ${i + 1}`} loading="lazy" className="h-28 w-auto rounded border" />
                </a>
              )),
            )}
          </div>
        </section>
      )}

      {RECEIPTS_ENABLED && fam.payments.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-title">{t.receipts}</h2>
          <ul className="card divide-y">
            {fam.payments.map((p) => (
              <li key={p.id} className="p-3 flex justify-between text-sm">
                <Link href={`/receipts/${p.id}`} className="text-brand-700">{p.receiptNo}</Link>
                <span>{p.date.toLocaleDateString("en-IN")}</span>
                <span className={p.cancelled ? "line-through text-stone-400" : "font-semibold"}>₹{p.total}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

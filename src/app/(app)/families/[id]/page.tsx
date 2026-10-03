import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getDict, getLang } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { relationLabel } from "@/lib/relations";
import { checkVoter } from "@/lib/eligibility";
import { effectiveAgeDate, getSettings } from "@/lib/settings";
import { memberFullName } from "@/lib/members";
import { approveKyc, confirmPanth, deleteFamily, deleteMember } from "../actions";
import ConfirmButton from "@/components/ConfirmButton";
import { formImageUrls } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function FamilyPage({ params }: { params: { id: string } }) {
  const s = await requireSession("view");
  const t = getDict();
  const lang = getLang();
  const fam = await prisma.family.findUnique({
    where: { id: params.id },
    include: {
      members: { orderBy: [{ isHead: "desc" }, { serial: "asc" }] },
      uploads: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { date: "desc" } },
      parentFamily: true,
      linkedFamilies: true,
    },
  });
  if (!fam) notFound();
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

      <section className="card p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">{fam.headName}</h1>
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
        {fam.panthStatus === "TO_VERIFY" && can(s.role, "approve") && (
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
            {fam.parentFamily && <Link className="text-brand-700 underline" href={`/families/${fam.parentFamily.id}`}>↑ {fam.parentFamily.code} {fam.parentFamily.headName}</Link>}
            {fam.linkedFamilies.map((l) => (
              <Link key={l.id} className="text-brand-700 underline mr-3" href={`/families/${l.id}`}>↳ {l.code} {l.headName}</Link>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          {can(s.role, "edit") && <Link href={`/families/${fam.id}/edit`} className="btn-secondary btn-sm">{t.edit}</Link>}
          {can(s.role, "edit") && <Link href={`/families/${fam.id}/member`} className="btn-primary btn-sm">+ {t.addMember}</Link>}
          {can(s.role, "receipts") && <Link href={`/receipts/new?family=${fam.id}`} className="btn-secondary btn-sm">+ {t.newReceipt}</Link>}
          {can(s.role, "delete") && fam.payments.length === 0 && (
            <form action={deleteFamily}>
              <input type="hidden" name="id" value={fam.id} />
              <ConfirmButton className="btn-danger btn-sm" message={`${fam.code} ${t.delete}?`}>{t.delete}</ConfirmButton>
            </form>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">{t.members} ({fam.members.length})</h2>
        {fam.members.map((m) => {
          const r = checkVoter(m, fam, { asOfDate: ageDate, applyStatusRules: settings.applyStatusRules });
          return (
            <div key={m.id} className="card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold">
                    {memberFullName(m)} {m.isHead && <span className="badge-gray ml-1">{t.isHead}</span>}
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
                    r.reasons.map((x) => <span key={x} className={x === "UNDER_AGE" ? "badge-gray" : "badge-amber"}>{t[x]}</span>)
                  )}
                  {m.status !== "ACTIVE" && <span className="badge-red">{t[m.status]}</span>}
                  {m.aadhaarLast4 || m.kycFileKey ? (
                    m.kycVerified ? <span className="badge-green">{t.kycVerified}</span> : <span className="badge-amber">{t.kycPending}</span>
                  ) : null}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {can(s.role, "edit") && <Link href={`/families/${fam.id}/member?m=${m.id}`} className="btn-secondary btn-sm">{t.edit}</Link>}
                {can(s.role, "approve") && !m.kycVerified && (m.aadhaarLast4 || m.kycFileKey) && (
                  <form action={approveKyc}>
                    <input type="hidden" name="memberId" value={m.id} />
                    <button className="btn-secondary btn-sm">KYC {t.approve}</button>
                  </form>
                )}
                {can(s.role, "viewAadhaar") && m.kycFileKey && (
                  <a href={`/api/files/kyc/${m.kycFileKey}`} target="_blank" className="btn-secondary btn-sm">{m.kycDocType && m.kycDocType !== "AADHAAR" ? m.kycDocType : t.aadhaar} 📄</a>
                )}
                {m.aadhaarLast4 && <span className="text-xs text-stone-500 self-center">{t.aadhaar}: XXXX XXXX {m.aadhaarLast4}</span>}
                {m.kycDocType && m.kycDocType !== "AADHAAR" && <span className="text-xs text-stone-500 self-center">KYC: {m.kycDocType}</span>}
                {m.dob && <span className="text-xs text-stone-500 self-center">{t.dob}: {m.dob.toLocaleDateString("en-IN")}</span>}
                {can(s.role, "delete") && (
                  <form action={deleteMember}>
                    <input type="hidden" name="memberId" value={m.id} />
                    <ConfirmButton className="btn-sm text-red-600 underline" message={`${memberFullName(m)}: ${t.delete}?`}>{t.delete}</ConfirmButton>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {fam.uploads.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">{t.upload}</h2>
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

      {fam.payments.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">{t.receipts}</h2>
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

import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getDict, getLang } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import { findDuplicates } from "@/lib/uploads";
import type { ExistingMember } from "@/lib/mergeMatch";
import { currentAge } from "@/lib/eligibility";
import { memberFullName } from "@/lib/members";
import type { ExtractedForm } from "@/lib/extract";
import { RELATIONS, relationFromRaw } from "@/lib/relations";
import { normalizeBloodGroup, normalizeMobile, parseAge, splitName } from "@/lib/normalize";
import Verifier, { type Row } from "./Verifier";
import ApplicationCheck from "./ApplicationCheck";
import { toEnglishName } from "@/lib/translit";
import { addressToEnglish } from "@/lib/addressEn";

/**
 * English spelling for the name parts. Uses the AI's English name when its words line up with the
 * Devanagari parts (same count after the title), otherwise the built-in converter.
 */
function englishFor(n: { title: string; firstName: string; middleName: string; surname: string }, aiEn?: string) {
  const parts = [n.firstName, n.middleName, n.surname];
  const filled = parts.filter(Boolean).length;
  let words = (aiEn ?? "").trim().split(/\s+/).filter(Boolean);
  if (n.title && words.length > filled) words = words.slice(words.length - filled);
  if (words.length === filled && filled > 0) {
    let w = 0;
    const out = parts.map((p) => (p ? words[w++] : ""));
    return { firstNameEn: out[0], middleNameEn: out[1], surnameEn: out[2] };
  }
  return { firstNameEn: toEnglishName(n.firstName), middleNameEn: toEnglishName(n.middleName), surnameEn: toEnglishName(n.surname) };
}
import { rejectUpload, retryUpload } from "../actions";
import { formImageUrls } from "@/lib/storage";

export const dynamic = "force-dynamic";

const PANTH_MAP = { STHANAKVASI: "STHANAKVASI", MANDIRMARGI: "MANDIRMARGI", TERAPANTH: "TERAPANTH", DIGAMBAR: "DIGAMBAR", BLANK: "UNKNOWN" } as const;

export default async function VerifyPage({ params, searchParams }: { params: { id: string }; searchParams: { e?: string } }) {
  await requireSession("upload");
  const t = getDict();
  const lang = getLang();
  const up = await prisma.formUpload.findUnique({ where: { id: params.id } });
  if (!up) notFound();
  if (up.status === "VERIFIED" && up.familyId) redirect(`/families/${up.familyId}`);
  if (up.kind === "INDIVIDUAL") return <ApplicationCheck up={up} error={searchParams.e} />;

  const x = (up.extracted as unknown as ExtractedForm | null) ?? {
    headName: "", address: "", panth: "BLANK" as const, panthEvidence: "", continuesOnNextPage: false, isContinuationPage: false, members: [], notes: "",
  };
  const manual = !up.extracted;
  const blank = { serial: 0, nameRaw: "", nameEn: "", age: "", relationRaw: "", education: "", occupation: "", mobile: "", bloodGroup: "", confidence: "high" as const, uncertainFields: [] as string[] };
  const members = manual ? Array.from({ length: 6 }, (_, i) => ({ ...blank, serial: i + 1, relationRaw: i === 0 ? "स्वतः" : "" })) : x.members;
  const rows: Row[] = members.map((m, i) => {
    const n = splitName(m.nameRaw);
    return {
      key: `r${i}`,
      nameRaw: m.nameRaw,
      title: n.title,
      firstName: n.firstName,
      middleName: n.middleName,
      surname: n.surname,
      ...englishFor(n, m.nameEn),
      age: parseAge(m.age)?.toString() ?? "",
      dob: (x.kyc ?? []).find((k) => k.memberSerial === m.serial && k.dob)?.dob ?? "",
      relation: relationFromRaw(m.relationRaw),
      relationRaw: m.relationRaw,
      education: m.education,
      occupation: m.occupation,
      mobile: normalizeMobile(m.mobile).value,
      bloodGroup: normalizeBloodGroup(m.bloodGroup),
      uncertain: [...m.uncertainFields, ...(m.mobile && !normalizeMobile(m.mobile).valid ? ["mobile"] : [])],
      low: m.confidence === "low",
    };
  });
  const kyc = (x.kyc ?? []).map((k, idx) => {
    const row = members.findIndex((m) => m.serial === k.memberSerial);
    return { idx, docType: k.docType, holderName: k.holderName, last4: k.last4, dob: k.dob, notes: k.notes, defaultKey: row >= 0 ? `r${row}` : null };
  });
  const dups = x.headName || x.members.length ? await findDuplicates(x) : [];
  // members of the possible duplicates, for the smart merge preview (23 Oct 2026)
  const dupMembers: Record<string, ExistingMember[]> = {};
  if (dups.length) {
    const ms = await prisma.member.findMany({ where: { familyId: { in: dups.map((d) => d.id) }, deletedAt: null }, orderBy: [{ isHead: "desc" }, { serial: "asc" }] });
    for (const m of ms) {
      (dupMembers[m.familyId] ??= []).push({
        id: m.id,
        name: memberFullName(m, true, lang === "en"),
        firstName: m.firstName, middleName: m.middleName, surname: m.surname,
        firstNameEn: m.firstNameEn, middleNameEn: m.middleNameEn, surnameEn: m.surnameEn,
        mobile: m.mobile,
        age: currentAge(m),
        dob: m.dob ? m.dob.toISOString().slice(0, 10) : null,
        education: m.education, occupation: m.occupation, bloodGroup: m.bloodGroup,
        hasKyc: !!m.kycFileKey,
      });
    }
  }

  return (
    <div className="space-y-3">
      <h1 className="page-title">{t.verifyTitle}</h1>
      <p className="text-sm text-stone-600">{t.verifyHelp}</p>
      {manual && up.status !== "FAILED" && (
        <div className="card p-3 border-sky-200 bg-sky-50 text-sm">{t.manualEntryHelp}</div>
      )}
      {up.status === "FAILED" && process.env.ANTHROPIC_API_KEY && (
        <div className="card p-3 border-red-200 bg-red-50 text-sm flex items-center justify-between gap-2">
          <span>{up.error}</span>
          <form action={retryUpload}><input type="hidden" name="id" value={up.id} /><button className="btn-secondary btn-sm">↻ {t.readForm}</button></form>
        </div>
      )}
      <Verifier
        uploadId={up.id}
        images={await formImageUrls(up.imageKeys)}
        initial={{
          headName: x.headName,
          headNameEn: x.headNameEn || toEnglishName(x.headName),
          address: x.address,
          addressEn: x.addressEn || addressToEnglish(x.address),
          panth: PANTH_MAP[x.panth],
          panthEvidence: x.panthEvidence,
          notes: [x.notes, x.continuesOnNextPage ? t.continuesNext : ""].filter(Boolean).join(" | "),
          rows,
        }}
        duplicates={dups}
        dupMembers={dupMembers}
        kyc={kyc}
        relations={RELATIONS.map((r) => ({ code: r.code, label: r[lang] }))}
        t={t}
      />
      <form action={rejectUpload}>
        <input type="hidden" name="id" value={up.id} />
        <button className="text-sm text-red-600 underline">{t.reject}</button>
      </form>
    </div>
  );
}

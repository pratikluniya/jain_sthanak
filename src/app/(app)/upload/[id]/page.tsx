import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getDict, getLang } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import { findDuplicates } from "@/lib/uploads";
import type { ExtractedForm } from "@/lib/extract";
import { RELATIONS, relationFromRaw } from "@/lib/relations";
import { normalizeBloodGroup, normalizeMobile, parseAge, splitName } from "@/lib/normalize";
import Verifier, { type Row } from "./Verifier";
import { rejectUpload, retryUpload } from "../actions";

export const dynamic = "force-dynamic";

const PANTH_MAP = { STHANAKVASI: "STHANAKVASI", MANDIRMARGI: "MANDIRMARGI", TERAPANTH: "TERAPANTH", DIGAMBAR: "DIGAMBAR", BLANK: "UNKNOWN" } as const;

export default async function VerifyPage({ params }: { params: { id: string } }) {
  await requireSession("upload");
  const t = getDict();
  const lang = getLang();
  const up = await prisma.formUpload.findUnique({ where: { id: params.id } });
  if (!up) notFound();
  if (up.status === "VERIFIED" && up.familyId) redirect(`/families/${up.familyId}`);

  const x = (up.extracted as unknown as ExtractedForm | null) ?? {
    headName: "", address: "", panth: "BLANK" as const, panthEvidence: "", continuesOnNextPage: false, isContinuationPage: false, members: [], notes: "",
  };
  const manual = !up.extracted;
  const blank = { serial: 0, nameRaw: "", age: "", relationRaw: "", education: "", occupation: "", mobile: "", bloodGroup: "", confidence: "high" as const, uncertainFields: [] as string[] };
  const members = manual ? Array.from({ length: 6 }, (_, i) => ({ ...blank, serial: i + 1, relationRaw: i === 0 ? "स्वतः" : "" })) : x.members;
  const rows: Row[] = members.map((m) => {
    const n = splitName(m.nameRaw);
    return {
      nameRaw: m.nameRaw,
      title: n.title,
      firstName: n.firstName,
      middleName: n.middleName,
      surname: n.surname,
      age: parseAge(m.age)?.toString() ?? "",
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
  const dups = x.headName || x.members.length ? await findDuplicates(x) : [];

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">{t.verifyTitle}</h1>
      <p className="text-sm text-stone-600">{t.verifyHelp}</p>
      {manual && up.status !== "FAILED" && (
        <div className="card p-3 border-sky-200 bg-sky-50 text-sm">फोटो पाहून माहिती टाइप करा. रिकाम्या ओळी जतन होणार नाहीत.</div>
      )}
      {up.status === "FAILED" && process.env.ANTHROPIC_API_KEY && (
        <div className="card p-3 border-red-200 bg-red-50 text-sm flex items-center justify-between gap-2">
          <span>{up.error}</span>
          <form action={retryUpload}><input type="hidden" name="id" value={up.id} /><button className="btn-secondary btn-sm">↻ {t.readForm}</button></form>
        </div>
      )}
      <Verifier
        uploadId={up.id}
        images={up.imageKeys.map((k) => `/api/files/forms/${k}`)}
        initial={{
          headName: x.headName,
          address: x.address,
          panth: PANTH_MAP[x.panth],
          panthEvidence: x.panthEvidence,
          notes: [x.notes, x.continuesOnNextPage ? t.continuesNext : ""].filter(Boolean).join(" | "),
          rows,
        }}
        duplicates={dups}
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

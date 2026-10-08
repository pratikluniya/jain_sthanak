// Check screen for an individual membership application (सभासद अर्ज): form photos beside the fields.
import type { FormUpload } from "@prisma/client";
import { getDict, getLang } from "@/lib/i18n";
import { EMPTY_APPLICATION, ExtractedApplication, parseFormDate } from "@/lib/applicationForm";
import { suggestFamilies } from "@/lib/applications";
import { RELATIONS } from "@/lib/relations";
import { normalizeMobile, parseAge, splitName } from "@/lib/normalize";
import { toEnglishName } from "@/lib/translit";
import { formImageUrls } from "@/lib/storage";
import ApplicationFieldsForm, { Field } from "@/components/ApplicationFieldsForm";
import ImageInput from "@/components/ImageInput";
import FamilyChooser from "./FamilyChooser";
import { saveApplicationAction } from "./applicationActions";
import { rejectUpload, retryUpload } from "../actions";

const TITLES = ["", "श्री", "सौ.", "श्रीमती", "कु.", "चि.", "डॉ."];

export default async function ApplicationCheck({ up, error }: { up: FormUpload; error?: string }) {
  const t = getDict();
  const lang = getLang();
  const parsed = ExtractedApplication.safeParse(up.extracted ?? {});
  const x = parsed.success ? parsed.data : EMPTY_APPLICATION;
  const manual = !up.extracted;

  // name: the AI / Cowork gives the parts; if only the raw name came, split it (surname first on this form)
  let parts = { title: x.title, firstName: x.firstName, middleName: x.middleName, surname: x.surname };
  if (!parts.firstName && x.nameRaw) {
    const n = splitName(x.nameRaw);
    const w = [n.firstName, n.middleName, n.surname].join(" ").split(" ").filter(Boolean); // surname, first, middle...
    parts = w.length > 1 ? { title: n.title, surname: w[0], firstName: w[1], middleName: w.slice(2).join(" ") } : { title: n.title, firstName: w[0] ?? "", middleName: "", surname: "" };
  }
  const en = {
    firstNameEn: x.firstNameEn || toEnglishName(parts.firstName),
    middleNameEn: x.middleNameEn || toEnglishName(parts.middleName),
    surnameEn: x.surnameEn || toEnglishName(parts.surname),
  };
  const gender = x.gender !== "UNKNOWN" ? x.gender : ["सौ.", "श्रीमती", "कु."].includes(parts.title) ? "FEMALE" : parts.title === "श्री" || parts.title === "चि." ? "MALE" : "UNKNOWN";
  const suggestions = parts.surname || parts.middleName || x.mobile ? await suggestFamilies({ ...parts, gender, mobile: x.mobile, homeAddress: x.homeAddress }) : [];
  const images = await formImageUrls(up.imageKeys);
  const [photoUrl] = x.photoKey ? await formImageUrls([x.photoKey]) : [];
  const u = (k: string) => x.uncertainFields.includes(k);
  const dob = parseFormDate(x.dob);

  return (
    <div className="space-y-3">
      <h1 className="page-title">{t.verifyTitle} · {t.formIndividual}</h1>
      {manual && up.status !== "FAILED" && <div className="card border-sky-200 bg-sky-50 p-3 text-sm">{t.manualEntryHelp}</div>}
      {up.status === "FAILED" && process.env.ANTHROPIC_API_KEY && (
        <div className="card flex items-center justify-between gap-2 border-red-200 bg-red-50 p-3 text-sm">
          <span>{up.error}</span>
          <form action={retryUpload}><input type="hidden" name="id" value={up.id} /><button className="btn-secondary btn-sm">↻ {t.readForm}</button></form>
        </div>
      )}
      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{t[`appErr_${error}` as keyof typeof t] ?? error}</p>}
      {x.notes && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">{t.notes}: {x.notes}</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-2 lg:sticky lg:top-4 lg:self-start">
          {images.map((src, i) => (
            <a key={src} href={src} target="_blank" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`page ${i + 1}`} className="w-full rounded-lg border" />
            </a>
          ))}
        </div>

        <form action={saveApplicationAction} className="card space-y-3 p-4" encType="multipart/form-data">
          <input type="hidden" name="uploadId" value={up.id} />
          <input type="hidden" name="nameRaw" value={x.nameRaw} />
          {x.nameRaw && <p className="text-sm text-stone-500">{t.onForm}: {x.nameRaw}</p>}

          <fieldset className="rounded-lg border p-3 space-y-2">
            <legend className="px-1 text-sm font-semibold">{t.applicant}</legend>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label" htmlFor="title">{t.title}</label>
                <select id="title" name="title" className="input" defaultValue={TITLES.includes(parts.title) ? parts.title : ""}>
                  {TITLES.map((v) => <option key={v} value={v}>{v || "-"}</option>)}
                </select>
              </div>
              <div className="col-span-2"><Field name="firstName" label={t.firstName} value={parts.firstName} required uncertain={u("name")} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field name="middleName" label={t.middleName} value={parts.middleName} uncertain={u("name")} />
              <Field name="surname" label={t.surname} value={parts.surname} uncertain={u("name")} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Field name="firstNameEn" label={`${t.firstName} (EN)`} value={en.firstNameEn} />
              <Field name="middleNameEn" label={`${t.middleName} (EN)`} value={en.middleNameEn} />
              <Field name="surnameEn" label={`${t.surname} (EN)`} value={en.surnameEn} />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="gender">{t.gender}</label>
                <select id="gender" name="gender" className="input" defaultValue={gender}>
                  <option value="UNKNOWN">-</option>
                  <option value="MALE">{t.MALE}</option>
                  <option value="FEMALE">{t.FEMALE}</option>
                </select>
              </div>
              <Field name="dob" label={t.dob} value={dob} type="date" hint={x.dob && !dob ? `${t.onForm}: ${x.dob}` : undefined} uncertain={u("dob")} />
              <Field name="age" label={t.age} value={parseAge(x.age)?.toString() ?? ""} inputMode="numeric" uncertain={u("age")} />
              <Field name="mobile" label={t.mobile} value={normalizeMobile(x.mobile).value} inputMode="tel" uncertain={u("mobile") || (!!x.mobile && !normalizeMobile(x.mobile).valid)} />
              <Field name="occupation" label={t.occupation} value={x.occupation} />
              <Field name="education" label={t.education} value="" />
            </div>
            <input type="hidden" name="bloodGroup" value="" />
          </fieldset>

          <FamilyChooser
            suggestions={suggestions}
            relations={RELATIONS.map((r) => ({ code: r.code, label: r[lang] }))}
            t={{ chooseFamily: t.chooseFamily, otherFamilyCode: t.otherFamilyCode, newFamilyFromApp: t.newFamilyFromApp, newFamilyHelp: t.newFamilyHelp, relation: t.relation, noSuggestions: t.noSuggestions, husbandMatch: t.husbandMatch }}
          />

          <fieldset className="rounded-lg border p-3 space-y-2">
            <legend className="px-1 text-sm font-semibold">{t.passportPhoto}</legend>
            {photoUrl && (
              <div className="flex items-center gap-3 text-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="" className="h-24 w-20 rounded border object-cover" />
                <span className="text-stone-600">{t.photoFromForm}</span>
              </div>
            )}
            <ImageInput name="photoFile" label={photoUrl ? t.replaceFile : t.passportPhoto} maxSide={600} t={{ uploaded: t.uploaded, replaceFile: t.replaceFile }} />
          </fieldset>

          <ApplicationFieldsForm
            t={t}
            uncertain={x.uncertainFields}
            raw={{ appDate: x.appDate, receiptDate: x.receiptDate, meetingDate: x.meetingDate }}
            d={{
              appNo: x.appNo,
              appDate: parseFormDate(x.appDate),
              homeAddress: x.homeAddress,
              businessAddress: x.businessAddress,
              email: x.email,
              landline: x.landline,
              feeEntry: x.feeEntry,
              feeAnnual: x.feeAnnual,
              feeLifetime: x.feeLifetime,
              feeTotal: x.feeTotal,
              receiptNo: x.receiptNo,
              receiptDate: parseFormDate(x.receiptDate),
              proposerName: x.proposer.name,
              proposerAddress: x.proposer.address,
              proposerMobile: x.proposer.mobile,
              proposerLandline: x.proposer.landline,
              seconderName: x.seconder.name,
              seconderAddress: x.seconder.address,
              seconderMobile: x.seconder.mobile,
              seconderLandline: x.seconder.landline,
              // only approved forms are being uploaded (8 Oct 2026); a form marked rejected stays rejected
              decision: x.decision === "REJECTED" ? "REJECTED" : "APPROVED",
              meetingDate: parseFormDate(x.meetingDate),
              rejectReasons: x.rejectReasons,
              docs: x.docs,
              notes: "",
            }}
          />
          <button className="btn-primary w-full sm:w-auto">{t.save}</button>
        </form>
      </div>
      <form action={rejectUpload}>
        <input type="hidden" name="id" value={up.id} />
        <button className="text-sm text-red-600 underline">{t.reject}</button>
      </form>
    </div>
  );
}

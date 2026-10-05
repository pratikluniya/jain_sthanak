import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getDict, getLang } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import { RELATIONS } from "@/lib/relations";
import { saveMember } from "../../actions";
import { headLabel } from "@/lib/members";

export default async function MemberFormPage({ params, searchParams }: { params: { id: string }; searchParams: { m?: string } }) {
  await requireSession("edit");
  const t = getDict();
  const lang = getLang();
  const fam = await prisma.family.findUnique({ where: { id: params.id } });
  if (!fam) notFound();
  const m = searchParams.m ? await prisma.member.findUnique({ where: { id: searchParams.m } }) : null;

  const field = (name: string, label: string, value: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} className="input" defaultValue={value} {...props} />
    </div>
  );

  return (
    <div className="space-y-3 max-w-xl">
      <h1 className="page-title">{m ? t.edit : t.addMember} <span className="text-base text-stone-500">· {fam.code} {headLabel(fam, lang === "en")}</span></h1>
      {m?.nameRaw && <p className="text-sm text-stone-500">{t.onForm}: {m.nameRaw} {m.relationRaw && `· ${m.relationRaw}`}</p>}
      <form action={saveMember} className="card p-4 space-y-3" encType="multipart/form-data">
        <input type="hidden" name="familyId" value={fam.id} />
        {m && <input type="hidden" name="memberId" value={m.id} />}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">{t.title}</label>
            <select name="title" className="input" defaultValue={m?.title ?? ""}>
              {["", "श्री", "सौ.", "श्रीमती", "कु.", "चि.", "डॉ.", "कै.", "स्व."].map((x) => <option key={x} value={x}>{x || "-"}</option>)}
            </select>
          </div>
          <div className="col-span-2">{field("firstName", t.firstName, m?.firstName ?? "", { required: true })}</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field("middleName", t.middleName, m?.middleName ?? "")}
          {field("surname", t.surname, m?.surname ?? fam.headName.split(" ").slice(-1)[0] ?? "")}
        </div>
        <fieldset className="border rounded-lg p-3 space-y-2">
          <legend className="text-sm font-semibold px-1">{t.nameEnglish}</legend>
          <div className="grid grid-cols-3 gap-2">
            {field("firstNameEn", t.firstName, m?.firstNameEn ?? "")}
            {field("middleNameEn", t.middleName, m?.middleNameEn ?? "")}
            {field("surnameEn", t.surname, m?.surnameEn ?? "")}
          </div>
          <p className="text-xs text-stone-500">{t.englishAutoHelp}</p>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t.relation}</label>
            <select name="relation" className="input" defaultValue={m?.relation ?? "OTHER"}>
              {RELATIONS.map((r) => <option key={r.code} value={r.code}>{r[lang]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t.gender}</label>
            <select name="gender" className="input" defaultValue={m?.gender ?? "UNKNOWN"}>
              <option value="UNKNOWN">-</option>
              <option value="MALE">{t.MALE}</option>
              <option value="FEMALE">{t.FEMALE}</option>
            </select>
          </div>
          {field("age", t.age, m?.age?.toString() ?? "", { inputMode: "numeric" })}
          {field("dob", t.dob, m?.dob ? m.dob.toISOString().slice(0, 10) : "", { type: "date" })}
          {field("education", t.education, m?.education ?? "")}
          {field("occupation", t.occupation, m?.occupation ?? "")}
          {field("mobile", t.mobile, m?.mobile ?? "", { inputMode: "tel" })}
          <div>
            <label className="label">{t.bloodGroup}</label>
            <select name="bloodGroup" className="input" defaultValue={m?.bloodGroup ?? ""}>
              {["", "A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((x) => <option key={x} value={x}>{x || "-"}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t.status}</label>
            <select name="status" className="input" defaultValue={m?.status ?? "ACTIVE"}>
              {(["ACTIVE", "DECEASED", "MARRIED_OUT", "MOVED_OUT"] as const).map((x) => <option key={x} value={x}>{t[x]}</option>)}
            </select>
          </div>
        </div>
        <fieldset className="border rounded-lg p-3 space-y-2">
          <legend className="text-sm font-semibold px-1">{t.kyc}</legend>
          {field("aadhaar", `${t.aadhaar}${m?.aadhaarLast4 ? ` (XXXX XXXX ${m.aadhaarLast4})` : ""}`, "", { inputMode: "numeric", placeholder: t.aadhaarPlaceholder, autoComplete: "off" })}
          <div>
            <label className="label">{t.aadhaar} scan</label>
            <input type="file" name="kycFile" accept="image/*,application/pdf" className="text-sm" />
          </div>
        </fieldset>
        <button className="btn-primary w-full sm:w-auto">{t.save}</button>
      </form>
    </div>
  );
}

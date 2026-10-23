"use client";
import { ageFromDobString } from "@/lib/eligibility";
import { useMemo, useState } from "react";
import { guessMatches, mergeDiff, type ExistingMember, type MergeField } from "@/lib/mergeMatch";
import { useRouter } from "next/navigation";
import type { Dict } from "@/lib/i18n";
import type { DuplicateCandidate } from "@/lib/uploads";
import { saveVerified } from "../actions";
import { toEnglishName } from "@/lib/translit";
import { addressToEnglish } from "@/lib/addressEn";

export interface Row {
  key: string; // stable id so KYC links survive row deletes
  nameRaw: string;
  title: string;
  firstName: string;
  middleName: string;
  surname: string;
  firstNameEn: string;
  middleNameEn: string;
  surnameEn: string;
  enTouched?: boolean; // volunteer typed the English spelling: stop auto-filling it
  age: string;
  dob: string; // YYYY-MM-DD, prefilled from the member's Aadhaar when the form reader found one (added 22 Oct 2026)
  relation: string;
  relationRaw: string;
  education: string;
  occupation: string;
  mobile: string;
  bloodGroup: string;
  uncertain: string[];
  low: boolean;
}

export interface KycInfo {
  idx: number;
  docType: string;
  holderName: string;
  last4: string | null;
  dob: string | null;
  notes: string;
  defaultKey: string | null;
}

type Panth = "STHANAKVASI" | "MANDIRMARGI" | "TERAPANTH" | "DIGAMBAR" | "UNKNOWN";

const EMPTY: Omit<Row, "key"> = {
  nameRaw: "", title: "", firstName: "", middleName: "", surname: "", firstNameEn: "", middleNameEn: "", surnameEn: "", age: "", dob: "", relation: "OTHER", relationRaw: "",
  education: "", occupation: "", mobile: "", bloodGroup: "", uncertain: [], low: false,
};

export default function Verifier(props: {
  uploadId: string;
  images: string[];
  initial: { headName: string; headNameEn: string; address: string; addressEn: string; panth: Panth; panthEvidence: string; notes: string; rows: Row[] };
  duplicates: DuplicateCandidate[];
  dupMembers?: Record<string, ExistingMember[]>;
  kyc: KycInfo[];
  relations: { code: string; label: string }[];
  t: Dict;
}) {
  const { t } = props;
  const router = useRouter();
  const [head, setHead] = useState(props.initial.headName);
  const [headEn, setHeadEn] = useState(props.initial.headNameEn);
  const [headEnTouched, setHeadEnTouched] = useState(false);
  const [address, setAddress] = useState(props.initial.address);
  const [addressEn, setAddressEn] = useState(props.initial.addressEn);
  const [addressEnTouched, setAddressEnTouched] = useState(false);
  const [panth, setPanth] = useState<Panth>(props.initial.panth);
  const [notes, setNotes] = useState(props.initial.notes);
  const [rows, setRows] = useState<Row[]>(props.initial.rows.length ? props.initial.rows : [{ ...EMPTY, key: "n0", relation: "SELF" }]);
  const [mode, setMode] = useState<"new" | "merge" | "linked">("new");
  const [target, setTarget] = useState(props.duplicates[0]?.id ?? "");
  const [imgIdx, setImgIdx] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // smart merge (23 Oct 2026): which existing member each form row is; the volunteer can change it
  const existing = useMemo(() => (mode === "merge" && target ? props.dupMembers?.[target] ?? [] : []), [mode, target, props.dupMembers]);
  const [matchOverride, setMatchOverride] = useState<Record<string, Record<string, string>>>({});
  const guessed = useMemo(() => guessMatches(rows, existing), [rows, existing]);
  const matchOf = (key: string) => matchOverride[target]?.[key] ?? guessed[key] ?? "";
  const setMatch = (key: string, id: string) => setMatchOverride((o) => ({ ...o, [target]: { ...(o[target] ?? {}), [key]: id } }));
  const fieldLabel: Record<MergeField, string> = {
    mobile: t.mobile, age: t.age, dob: t.dob, education: t.education, occupation: t.occupation, bloodGroup: t.bloodGroup, englishName: t.nameEnglish,
  };
  const [kycTo, setKycTo] = useState<Record<number, string>>(() =>
    Object.fromEntries(props.kyc.map((k) => [k.idx, k.defaultKey ?? ""])),
  );

  const EN_OF: Partial<Record<keyof Row, keyof Row>> = { firstName: "firstNameEn", middleName: "middleNameEn", surname: "surnameEn" };
  const upd = (i: number, k: keyof Row, v: string) =>
    setRows((rs) =>
      rs.map((r, j) => {
        if (j !== i) return r;
        const next: Row = { ...r, [k]: v, uncertain: r.uncertain.filter((u) => !fieldMatches(u, k)) };
        // Devanagari name changed and the English spelling was not typed by hand: spell it again
        const enKey = EN_OF[k];
        if (enKey && !r.enTouched) (next as unknown as Record<string, string>)[enKey] = toEnglishName(v);
        if (k === "firstNameEn" || k === "middleNameEn" || k === "surnameEn") next.enTouched = true;
        return next;
      }),
    );

  function fieldMatches(u: string, k: keyof Row) {
    if (u === "name") return ["firstName", "middleName", "surname", "title"].includes(k);
    if (u === "relation") return k === "relation";
    return u === k;
  }
  const warn = (r: Row, f: string) => (r.uncertain.includes(f) ? "bg-amber-100 border-amber-400" : "");

  async function save() {
    setBusy(true);
    setErr("");
    try {
      const res = await saveVerified({
        uploadId: props.uploadId,
        mode,
        targetFamilyId: mode === "new" ? undefined : target,
        headName: head,
        headNameEn: headEn,
        address,
        addressEn,
        panth,
        panthConfirmed: panth !== "UNKNOWN",
        notes,
        members: rows.map(({ uncertain: _u, low: _l, enTouched: _e, ...r }) => r),
        matches: mode === "merge" ? Object.fromEntries(rows.map((r) => [r.key, matchOf(r.key)])) : {},
        kycAssign: Object.entries(kycTo)
          .filter(([, key]) => key && rows.some((r) => r.key === key))
          .map(([idx, key]) => ({ idx: Number(idx), key })),
      });
      if (res.error) throw new Error(res.error);
      router.push(`/families/${res.familyId}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-3 lg:space-y-0">
      {/* Photo */}
      <div className="sticky top-0 z-10 lg:top-2 lg:self-start">
        <div className="card p-2 shadow-md">
          <div className={`overflow-auto ${zoom ? "max-h-[45vh] lg:max-h-[80vh]" : "max-h-[35vh] lg:max-h-[80vh]"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={props.images[imgIdx]} alt="form" className={zoom ? "max-w-none w-[250%] lg:w-[180%]" : "w-full object-contain"} />
          </div>
          <div className="flex gap-2 mt-1">
            <button type="button" className="btn-secondary btn-sm" onClick={() => setZoom((z) => !z)}>{zoom ? "🔍−" : "🔍+"}</button>
            <a className="btn-secondary btn-sm" href={props.images[imgIdx]} target="_blank" rel="noreferrer">⤢</a>
          </div>
          {props.images.length > 1 && (
            <div className="flex gap-2 mt-2">
              {props.images.map((_, i) => (
                <button key={i} className={i === imgIdx ? "btn-primary btn-sm" : "btn-secondary btn-sm"} onClick={() => setImgIdx(i)}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Data */}
      <div className="space-y-3">
        <div className="card p-3 space-y-2">
          <div>
            <label className="label">{t.headName}</label>
            <input
              className="input"
              value={head}
              onChange={(e) => {
                setHead(e.target.value);
                if (!headEnTouched) setHeadEn(toEnglishName(e.target.value));
              }}
            />
          </div>
          <div>
            <label className="label">{t.headNameEn}</label>
            <input className="input" value={headEn} onChange={(e) => { setHeadEn(e.target.value); setHeadEnTouched(true); }} />
          </div>
          <div>
            <label className="label">{t.address}</label>
            <textarea
              className="input"
              rows={2}
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                if (!addressEnTouched) setAddressEn(addressToEnglish(e.target.value));
              }}
            />
          </div>
          <div>
            <label className="label">{t.addressEn}</label>
            <textarea className="input" rows={2} value={addressEn} onChange={(e) => { setAddressEn(e.target.value); setAddressEnTouched(true); }} />
          </div>
          <div>
            <label className="label">{t.panth}</label>
            <div className="flex flex-wrap gap-2">
              {(["STHANAKVASI", "MANDIRMARGI", "TERAPANTH", "DIGAMBAR", "UNKNOWN"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPanth(p)}
                  className={`btn-sm rounded-lg border ${panth === p ? (p === "UNKNOWN" ? "bg-amber-500 text-white border-amber-500" : "bg-brand-600 text-white border-brand-600") : "bg-white"}`}
                >
                  {p === "UNKNOWN" ? t.toVerify : t[p]}
                </button>
              ))}
            </div>
            {props.initial.panthEvidence && <p className="text-xs text-stone-500 mt-1">AI: {props.initial.panthEvidence}</p>}
          </div>
          <div>
            <label className="label">{t.notes}</label>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        {rows.map((r, i) => (
          <div key={i} className={`card p-3 space-y-2 ${r.low ? "border-amber-300" : ""}`}>
            <div className="flex justify-between items-center">
              <span className="text-xs text-stone-500">#{i + 1} · {t.onForm}: <b>{r.nameRaw || "-"}</b></span>
              <button type="button" className="text-xs text-red-600" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>{t.delete}</button>
            </div>
            {mode === "merge" && existing.length > 0 && (() => {
              const id = matchOf(r.key);
              const m = existing.find((e) => e.id === id);
              const d = m ? mergeDiff(r, m) : null;
              const kycHere = Object.values(kycTo).includes(r.key);
              return (
                <div className={`rounded-lg border p-2 text-sm space-y-1 ${m ? "border-sky-200 bg-sky-50" : "border-green-200 bg-green-50"}`}>
                  <label className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{t.mergeSamePerson}:</span>
                    <select className="input w-auto py-1" value={id} onChange={(e) => setMatch(r.key, e.target.value)}>
                      <option value="">➕ {t.mergeNewMember}</option>
                      {existing.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </label>
                  {d && (d.fill.length > 0 ? <p className="text-green-800">✚ {t.mergeWillFill}: {d.fill.map((f) => fieldLabel[f]).join(", ")}</p> : <p className="text-stone-600">{t.mergeNothingNew}</p>)}
                  {d?.conflicts.map((c) => (
                    <p key={c.field} className="text-amber-800">⚠ {fieldLabel[c.field]}: {t.mergeSaved} <b>{c.saved}</b> · {t.mergeOnForm} <b>{c.form}</b> ({t.mergeKeptSaved})</p>
                  ))}
                  {m && kycHere && (m.hasKyc ? <p className="text-stone-600">🪪 {t.mergeKycSkipped}</p> : <p className="text-green-800">🪪 {t.mergeKycAdded}</p>)}
                </div>
              );
            })()}
            <div className="grid grid-cols-4 gap-2">
              <select className={`input ${warn(r, "name")}`} value={r.title} onChange={(e) => upd(i, "title", e.target.value)}>
                {["", "श्री", "सौ.", "श्रीमती", "कु.", "चि.", "डॉ.", "कै.", "स्व."].map((x) => <option key={x} value={x}>{x || "-"}</option>)}
              </select>
              <input className={`input col-span-3 ${warn(r, "name")}`} placeholder={t.firstName} value={r.firstName} onChange={(e) => upd(i, "firstName", e.target.value)} />
              <input className={`input col-span-2 ${warn(r, "name")}`} placeholder={t.middleName} value={r.middleName} onChange={(e) => upd(i, "middleName", e.target.value)} />
              <input className={`input col-span-2 ${warn(r, "name")}`} placeholder={t.surname} value={r.surname} onChange={(e) => upd(i, "surname", e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">{t.nameEnglish}</label>
              <div className="grid grid-cols-3 gap-2">
                <input className="input" placeholder={t.firstName} value={r.firstNameEn} onChange={(e) => upd(i, "firstNameEn", e.target.value)} />
                <input className="input" placeholder={t.middleName} value={r.middleNameEn} onChange={(e) => upd(i, "middleNameEn", e.target.value)} />
                <input className="input" placeholder={t.surname} value={r.surnameEn} onChange={(e) => upd(i, "surnameEn", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div>
                <label className="label text-xs">{t.age}</label>
                <input
                  className={`input ${ageFromDobString(r.dob) ? "bg-stone-100 text-stone-600" : warn(r, "age")}`}
                  inputMode="numeric"
                  value={ageFromDobString(r.dob) || r.age}
                  readOnly={!!ageFromDobString(r.dob)}
                  onChange={(e) => upd(i, "age", e.target.value)}
                />
              </div>
              <div>
                <label className="label text-xs">{t.dob}</label>
                <input className="input" type="date" max={new Date().toISOString().slice(0, 10)} value={r.dob} onChange={(e) => upd(i, "dob", e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">{t.relation} {r.relationRaw && <span className="text-stone-400">({r.relationRaw})</span>}</label>
                <select className={`input ${warn(r, "relation")} ${r.relation === "OTHER" && r.relationRaw ? "bg-amber-100" : ""}`} value={r.relation} onChange={(e) => upd(i, "relation", e.target.value)}>
                  {props.relations.map((x) => <option key={x.code} value={x.code}>{x.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label text-xs">{t.mobile}</label>
                <input className={`input ${warn(r, "mobile")}`} inputMode="tel" value={r.mobile} onChange={(e) => upd(i, "mobile", e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">{t.education}</label>
                <input className={`input ${warn(r, "education")}`} value={r.education} onChange={(e) => upd(i, "education", e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">{t.occupation}</label>
                <input className={`input ${warn(r, "occupation")}`} value={r.occupation} onChange={(e) => upd(i, "occupation", e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">{t.bloodGroup}</label>
                <select className={`input ${warn(r, "bloodGroup")}`} value={r.bloodGroup} onChange={(e) => upd(i, "bloodGroup", e.target.value)}>
                  {["", "A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((x) => <option key={x} value={x}>{x || "-"}</option>)}
                </select>
              </div>
            </div>
          </div>
        ))}
        <button type="button" className="btn-secondary w-full" onClick={() => setRows((rs) => [...rs, { ...EMPTY, key: `n${Date.now()}` }])}>+ {t.addMember}</button>

        {props.kyc.length > 0 && (
          <div className="card p-3 border-sky-200 bg-sky-50 space-y-2 text-sm">
            <p className="font-semibold">🪪 {t.kyc}</p>
            {props.kyc.map((k) => (
              <div key={k.idx} className="space-y-1">
                <div>
                  <b>{k.docType === "AADHAAR" ? t.aadhaar : k.docType}</b>
                  {k.last4 && <> · XXXX XXXX {k.last4}</>} · {k.holderName}
                  {k.dob && <> · {t.dob}: {k.dob}</>}
                </div>
                {k.notes && <div className="text-amber-800">⚠ {k.notes}</div>}
                <select className="input" value={kycTo[k.idx] ?? ""} onChange={(e) => setKycTo((m) => ({ ...m, [k.idx]: e.target.value }))}>
                  <option value="">-</option>
                  {rows.map((r) => (
                    <option key={r.key} value={r.key}>{[r.title, r.firstName, r.middleName, r.surname].filter(Boolean).join(" ") || r.nameRaw}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

        {props.duplicates.length > 0 && (
          <div className="card p-3 border-amber-300 bg-amber-50 space-y-2">
            <p className="font-semibold text-sm">⚠ {t.possibleDuplicate}</p>
            {props.duplicates.map((d) => (
              <label key={d.id} className="flex gap-2 text-sm items-start">
                <input type="radio" name="target" checked={target === d.id} onChange={() => setTarget(d.id)} />
                <span>
                  <b>{d.code}</b> {d.headName} <span className="text-stone-500">· {d.address} ({d.reason})</span>
                </span>
              </label>
            ))}
            <div className="flex flex-col gap-1 text-sm pt-1">
              <label className="flex gap-2"><input type="radio" name="mode" checked={mode === "new"} onChange={() => setMode("new")} /> {t.saveAsNew}</label>
              <label className="flex gap-2"><input type="radio" name="mode" checked={mode === "merge"} onChange={() => setMode("merge")} /> {t.addToExisting}</label>
              {mode === "merge" && <p className="rounded bg-white/70 p-2 text-xs text-stone-700">{t.mergeHelp}</p>}
              <label className="flex gap-2"><input type="radio" name="mode" checked={mode === "linked"} onChange={() => setMode("linked")} /> {t.saveAsNew} + {t.linkedFamily}</label>
            </div>
          </div>
        )}

        {err && <p className="text-red-600 text-sm">{err}</p>}
        <button className="btn-primary w-full py-3" disabled={busy || !head.trim()} onClick={save}>
          {busy ? "..." : `✔ ${t.save}`}
        </button>
      </div>
    </div>
  );
}

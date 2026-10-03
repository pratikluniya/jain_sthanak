"use client";
import { useState } from "react";

type ListKind = "voters" | "members";

export default function ExportForm(props: {
  initialList: ListKind;
  fields: { key: string; label: string }[];
  defaults: Record<ListKind, string[]>;
  langs: { code: string; label: string }[];
  initialLang: string;
  t: Record<"voterList" | "allMembers" | "chooseFields" | "downloadExcel" | "printPdf" | "exportLanguage", string>;
}) {
  const [list, setList] = useState<ListKind>(props.initialList);
  const [lang, setLang] = useState(props.initialLang);
  const [picked, setPicked] = useState<string[]>(props.defaults[props.initialList]);
  // keep the canonical column order
  const ordered = props.fields.map((f) => f.key).filter((k) => picked.includes(k));
  const qs = `list=${list}&fields=${ordered.join(",")}&lang=${lang}`;

  function switchList(l: ListKind) {
    setList(l);
    setPicked(props.defaults[l]);
  }

  return (
    <div className="card p-4 space-y-4">
      <div className="flex gap-2">
        <button className={list === "voters" ? "btn-primary" : "btn-secondary"} onClick={() => switchList("voters")}>{props.t.voterList}</button>
        <button className={list === "members" ? "btn-primary" : "btn-secondary"} onClick={() => switchList("members")}>{props.t.allMembers}</button>
      </div>
      <div>
        <p className="label">{props.t.exportLanguage}</p>
        <div className="flex gap-2">
          {props.langs.map((l) => (
            <button key={l.code} type="button" className={lang === l.code ? "btn-primary btn-sm" : "btn-secondary btn-sm"} onClick={() => setLang(l.code)}>
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="label">{props.t.chooseFields}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {props.fields.map((f) => (
            <label key={f.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={picked.includes(f.key)}
                onChange={(e) => setPicked((p) => (e.target.checked ? [...p, f.key] : p.filter((x) => x !== f.key)))}
              />
              {f.label}
            </label>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <a className={`btn-primary ${ordered.length ? "" : "pointer-events-none opacity-50"}`} href={`/api/export?${qs}`}>⬇ {props.t.downloadExcel}</a>
        <a className={`btn-secondary ${ordered.length ? "" : "pointer-events-none opacity-50"}`} href={`/print?${qs}`}>🖨 {props.t.printPdf}</a>
      </div>
    </div>
  );
}

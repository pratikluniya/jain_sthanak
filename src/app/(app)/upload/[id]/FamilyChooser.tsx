"use client";
// Where the applicant goes: one of the suggested families, a family typed by code, or a new family.
// Picking a suggestion also picks the relation found for it (e.g. wife of the head, daughter-in-law).
import { useState } from "react";
import type { FamilySuggestion } from "@/lib/applications";

export default function FamilyChooser(props: {
  suggestions: FamilySuggestion[];
  relations: { code: string; label: string }[];
  t: Record<"chooseFamily" | "otherFamilyCode" | "newFamilyFromApp" | "newFamilyHelp" | "relation" | "noSuggestions" | "husbandMatch" | "samePerson" | "newMemberHere" | "samePersonHelp" | "hasApplication", string>;
}) {
  const first = props.suggestions[0];
  const [choice, setChoice] = useState<string>(first ? first.code : "__other");
  const [relation, setRelation] = useState<string>(first ? first.relation : "WIFE");
  // the applicant may already be a member of the chosen family (census form): link instead of adding again
  const firstSame = (s?: FamilySuggestion) => s?.sameMembers.find((m) => !m.hasApplication)?.id ?? "";
  const [memberId, setMemberId] = useState<string>(firstSame(first));
  const isNew = choice === "__new";
  const chosen = props.suggestions.find((s) => s.code === choice);

  const pick = (code: string, rel?: string) => {
    setChoice(code);
    if (rel) setRelation(rel);
    setMemberId(firstSame(props.suggestions.find((s) => s.code === code)));
  };

  return (
    <fieldset className="rounded-lg border-2 border-brand-200 p-3 space-y-2">
      <legend className="px-1 text-sm font-semibold">{props.t.chooseFamily}</legend>
      <input type="hidden" name="mode" value={isNew ? "new" : "existing"} />
      {choice !== "__other" && !isNew && <input type="hidden" name="familyCode" value={choice} />}
      {props.suggestions.length === 0 && <p className="text-sm text-stone-500">{props.t.noSuggestions}</p>}
      {props.suggestions.map((s) => (
        <label key={s.id} className={`flex cursor-pointer gap-2 rounded-lg border p-2 text-sm ${choice === s.code ? "border-brand-500 bg-brand-50" : "border-stone-200"}`}>
          <input type="radio" name="familyPick" checked={choice === s.code} onChange={() => pick(s.code, s.relation)} />
          <span className="min-w-0">
            <b>{s.code}</b> · {s.headName}
            <span className="block text-xs text-stone-500">{s.address}</span>
            {s.matchedMember && <span className="block text-xs text-green-700">{props.t.husbandMatch}: {s.matchedMember}</span>}
            <span className="block text-xs text-stone-400">{s.reasons.join(", ")}</span>
          </span>
        </label>
      ))}
      <label className={`flex items-center gap-2 rounded-lg border p-2 text-sm ${choice === "__other" ? "border-brand-500 bg-brand-50" : "border-stone-200"}`}>
        <input type="radio" name="familyPick" checked={choice === "__other"} onChange={() => pick("__other")} />
        <span className="shrink-0">{props.t.otherFamilyCode}</span>
        {choice === "__other" && <input name="familyCode" className="input py-1" placeholder="NR-0123" required />}
      </label>
      <label className={`flex gap-2 rounded-lg border p-2 text-sm ${isNew ? "border-brand-500 bg-brand-50" : "border-stone-200"}`}>
        <input type="radio" name="familyPick" checked={isNew} onChange={() => pick("__new")} />
        <span>
          {props.t.newFamilyFromApp}
          <span className="block text-xs text-stone-500">{props.t.newFamilyHelp}</span>
        </span>
      </label>
      {chosen && chosen.sameMembers.length > 0 && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-2 text-sm space-y-1">
          {chosen.sameMembers.map((m) => (
            <label key={m.id} className={`flex items-center gap-2 ${m.hasApplication ? "text-stone-400" : ""}`}>
              <input type="radio" name="samePick" checked={memberId === m.id} disabled={m.hasApplication} onChange={() => setMemberId(m.id)} />
              <span>{props.t.samePerson}: <b>{m.name}</b>{m.hasApplication && ` (${props.t.hasApplication})`}</span>
            </label>
          ))}
          <label className="flex items-center gap-2">
            <input type="radio" name="samePick" checked={memberId === ""} onChange={() => setMemberId("")} />
            <span>{props.t.newMemberHere}</span>
          </label>
          {memberId && <p className="text-xs text-stone-600">{props.t.samePersonHelp}</p>}
        </div>
      )}
      {memberId && chosen && <input type="hidden" name="memberId" value={memberId} />}
      {!isNew && !(memberId && chosen) && (
        <div>
          <label className="label" htmlFor="relation">{props.t.relation}</label>
          <select id="relation" name="relation" className="input" value={relation} onChange={(e) => setRelation(e.target.value)}>
            {props.relations.filter((r) => r.code !== "SELF").map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select>
        </div>
      )}
    </fieldset>
  );
}

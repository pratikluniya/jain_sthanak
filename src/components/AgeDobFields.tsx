"use client";
// Age and birth date side by side (decided 23 Oct 2026): typing a DOB fills the age and locks it,
// so the two can never disagree. Without a DOB the age is typed by hand.
import { useState } from "react";
import { ageFromDobString } from "@/lib/eligibility";

export default function AgeDobFields(p: {
  ageLabel: string;
  dobLabel: string;
  age: string;
  dob: string;
  ageName?: string;
  dobName?: string;
  ageUncertain?: boolean;
  dobUncertain?: boolean;
  dobHint?: string;
  dobFirst?: boolean;
}) {
  const [dob, setDob] = useState(p.dob);
  const [typedAge, setTypedAge] = useState(p.age);
  const fromDob = ageFromDobString(dob);
  const age = fromDob || typedAge;
  const ageName = p.ageName ?? "age";
  const dobName = p.dobName ?? "dob";
  const warn = (u?: boolean) => (u ? "border-amber-400 bg-amber-50" : "");
  const mark = (u?: boolean) => u && <span className="text-amber-600" title="?">⚠</span>;
  const ageBox = (
    <div key="age">
      <label className="label" htmlFor={ageName}>{p.ageLabel} {mark(p.ageUncertain && !fromDob)}</label>
      <input
        id={ageName}
        name={ageName}
        className={`input ${fromDob ? "bg-stone-100 text-stone-600" : warn(p.ageUncertain)}`}
        inputMode="numeric"
        value={age}
        readOnly={!!fromDob}
        title={fromDob ? "From the birth date" : undefined}
        onChange={(e) => setTypedAge(e.target.value)}
      />
    </div>
  );
  const dobBox = (
    <div key="dob">
      <label className="label" htmlFor={dobName}>{p.dobLabel} {mark(p.dobUncertain)}</label>
      <input
        id={dobName}
        name={dobName}
        type="date"
        className={`input ${warn(p.dobUncertain)}`}
        max={new Date().toISOString().slice(0, 10)}
        value={dob}
        onChange={(e) => setDob(e.target.value)}
      />
      {p.dobHint && <p className="mt-0.5 text-xs text-stone-500">{p.dobHint}</p>}
    </div>
  );
  return <>{p.dobFirst ? [dobBox, ageBox] : [ageBox, dobBox]}</>;
}

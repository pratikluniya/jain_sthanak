"use client";
// Home address as written (Marathi) + its English spelling, on the individual application check screen (4 Nov 2026).
// The English box is filled automatically and follows the Marathi box until the volunteer edits it,
// the same way as the family check screen.
import { useState } from "react";
import { addressToEnglish } from "@/lib/addressEn";

export default function AddressPairFields(p: {
  address: string;
  addressEn: string;
  uncertain?: boolean;
  t: { homeAddress: string; homeAddressEn: string; homeAddressEnHelp: string };
}) {
  const [en, setEn] = useState(p.addressEn || addressToEnglish(p.address));
  const [touched, setTouched] = useState(false);
  return (
    <>
      <div>
        <label className="label" htmlFor="homeAddress">
          {p.t.homeAddress} {p.uncertain && <span className="text-amber-600" title="?">⚠</span>}
        </label>
        <textarea
          id="homeAddress"
          name="homeAddress"
          rows={2}
          className={`input ${p.uncertain ? "border-amber-400 bg-amber-50" : ""}`}
          defaultValue={p.address}
          onChange={(e) => {
            if (!touched) setEn(addressToEnglish(e.target.value));
          }}
        />
      </div>
      <div>
        <label className="label" htmlFor="homeAddressEn">{p.t.homeAddressEn}</label>
        <textarea
          id="homeAddressEn"
          name="homeAddressEn"
          rows={2}
          className="input"
          value={en}
          onChange={(e) => {
            setEn(e.target.value);
            setTouched(true);
          }}
        />
        <p className="mt-0.5 text-xs text-stone-500">{p.t.homeAddressEnHelp}</p>
      </div>
    </>
  );
}

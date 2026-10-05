"use client";
// Member status + date of death. The date shows (and is compulsory) only when the status is "Deceased".
import { useState } from "react";

export default function StatusField(props: {
  defaultStatus: string;
  defaultDate: string;
  today: string;
  options: { value: string; label: string }[];
  t: { status: string; dateOfDeath: string };
}) {
  const [status, setStatus] = useState(props.defaultStatus);
  return (
    <>
      <div>
        <label htmlFor="status" className="label">{props.t.status}</label>
        <select id="status" name="status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          {props.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {status === "DECEASED" && (
        <div>
          <label htmlFor="dateOfDeath" className="label">{props.t.dateOfDeath} <span className="text-red-600">*</span></label>
          <input id="dateOfDeath" name="dateOfDeath" type="date" className="input" defaultValue={props.defaultDate} max={props.today} required />
        </div>
      )}
    </>
  );
}

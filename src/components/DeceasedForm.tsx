"use client";
// Date of death (optional) + new head of family when the head passes away. Used on the family page and in the reminder popup.
import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { markDeceasedAction, type MarkState } from "@/app/(app)/deceasedActions";

export interface DeceasedLabels {
  markDeceased: string;
  dateOfDeath: string;
  optional: string;
  newHead: string;
  chooseNewHead: string;
  noOtherMember: string;
  mustChooseHead: string;
  dateInFuture: string;
  notFound: string;
  cancel: string;
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button className="btn-danger" disabled={pending}>{pending ? "..." : label}</button>;
}

export default function DeceasedForm(props: {
  member: { id: string; name: string; isHead: boolean };
  others: { id: string; name: string }[];
  today: string;
  t: DeceasedLabels;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [state, action] = useFormState<MarkState, FormData>(markDeceasedAction, {});
  const { onDone } = props;
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="memberId" value={props.member.id} />
      <p className="font-semibold">{props.member.name}</p>
      <div>
        <label htmlFor={`dod-${props.member.id}`} className="label">{props.t.dateOfDeath} <span className="font-normal text-stone-400">{props.t.optional}</span></label>
        <input id={`dod-${props.member.id}`} name="dateOfDeath" type="date" max={props.today} className="input" />
      </div>
      {props.member.isHead && props.others.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="mb-2 text-sm text-amber-900">{props.t.chooseNewHead}</p>
          <label htmlFor={`nh-${props.member.id}`} className="label">{props.t.newHead}</label>
          <select id={`nh-${props.member.id}`} name="newHeadId" className="input" required defaultValue="">
            <option value="" disabled>-</option>
            {props.others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
      )}
      {props.member.isHead && props.others.length === 0 && <p className="text-sm text-stone-600">{props.t.noOtherMember}</p>}
      {state.error && <p className="text-sm text-red-600" role="alert">{props.t[state.error]}</p>}
      <div className="flex gap-2">
        <Submit label={props.t.markDeceased} />
        <button type="button" className="btn-secondary" onClick={props.onCancel}>{props.t.cancel}</button>
      </div>
    </form>
  );
}

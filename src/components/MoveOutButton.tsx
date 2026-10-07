"use client";
// "Moved out" button + popup for one member or a whole family: date (compulsory), new place and remark (optional),
// and the new head of family when the head moves out alone.
import { useCallback, useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Modal from "./Modal";
import { moveOutAction, type MoveState } from "@/app/(app)/movedOutActions";

export interface MoveLabels {
  markMovedOut: string;
  familyMovedOutBtn: string;
  dateMoved: string;
  newPlace: string;
  remarkLabel: string;
  optional: string;
  newHead: string;
  chooseNewHead: string;
  noOtherMember: string;
  familyMoveAllMembers: string;
  mustChooseHead: string;
  dateInFuture: string;
  dateRequired: string;
  notFound: string;
  cancel: string;
  close: string;
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button className="btn-danger" disabled={pending}>{pending ? "..." : label}</button>;
}

function MoveForm(props: { target: { familyId?: string; memberId?: string; name: string; isHead?: boolean }; others: { id: string; name: string }[]; today: string; t: MoveLabels; onDone: () => void }) {
  const [state, action] = useFormState<MoveState, FormData>(moveOutAction, {});
  const { onDone } = props;
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);
  const id = props.target.familyId ?? props.target.memberId ?? "x";
  const title = props.target.familyId ? props.t.familyMovedOutBtn : props.t.markMovedOut;
  return (
    <form action={action} className="space-y-4">
      {props.target.familyId && <input type="hidden" name="familyId" value={props.target.familyId} />}
      {props.target.memberId && <input type="hidden" name="memberId" value={props.target.memberId} />}
      <p className="font-semibold">{props.target.name}</p>
      {props.target.familyId && <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{props.t.familyMoveAllMembers}</p>}
      <div>
        <label htmlFor={`mv-d-${id}`} className="label">{props.t.dateMoved} <span className="text-red-600">*</span></label>
        <input id={`mv-d-${id}`} name="date" type="date" max={props.today} className="input" required />
      </div>
      <div>
        <label htmlFor={`mv-c-${id}`} className="label">{props.t.newPlace} <span className="font-normal text-stone-400">{props.t.optional}</span></label>
        <input id={`mv-c-${id}`} name="city" className="input" maxLength={200} />
      </div>
      <div>
        <label htmlFor={`mv-r-${id}`} className="label">{props.t.remarkLabel} <span className="font-normal text-stone-400">{props.t.optional}</span></label>
        <input id={`mv-r-${id}`} name="remark" className="input" maxLength={200} />
      </div>
      {props.target.isHead && props.others.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="mb-2 text-sm text-amber-900">{props.t.chooseNewHead}</p>
          <label htmlFor={`mv-h-${id}`} className="label">{props.t.newHead}</label>
          <select id={`mv-h-${id}`} name="newHeadId" className="input" required defaultValue="">
            <option value="" disabled>-</option>
            {props.others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
      )}
      {props.target.isHead && props.others.length === 0 && <p className="text-sm text-stone-600">{props.t.noOtherMember}</p>}
      {state.error && <p className="text-sm text-red-600" role="alert">{props.t[state.error]}</p>}
      <div className="flex gap-2">
        <Submit label={title} />
        <button type="button" className="btn-secondary" onClick={onDone}>{props.t.cancel}</button>
      </div>
    </form>
  );
}

export default function MoveOutButton(props: {
  target: { familyId?: string; memberId?: string; name: string; isHead?: boolean };
  others?: { id: string; name: string }[];
  today: string;
  t: MoveLabels;
  small?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const title = props.target.familyId ? props.t.familyMovedOutBtn : props.t.markMovedOut;
  return (
    <>
      <button type="button" className={props.small === false ? "btn-secondary" : "btn-secondary btn-sm"} onClick={() => setOpen(true)}>↗ {title}</button>
      {open && (
        <Modal title={title} onClose={close} closeLabel={props.t.close}>
          <MoveForm target={props.target} others={props.others ?? []} today={props.today} t={props.t} onDone={close} />
        </Modal>
      )}
    </>
  );
}

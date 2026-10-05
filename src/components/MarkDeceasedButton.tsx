"use client";
import { useCallback, useState } from "react";
import Modal from "./Modal";
import DeceasedForm, { type DeceasedLabels } from "./DeceasedForm";

export default function MarkDeceasedButton(props: {
  member: { id: string; name: string; isHead: boolean };
  others: { id: string; name: string }[];
  today: string;
  t: DeceasedLabels & { close: string };
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(true)}>{props.t.markDeceased}</button>
      {open && (
        <Modal title={props.t.markDeceased} onClose={close} closeLabel={props.t.close}>
          <DeceasedForm member={props.member} others={props.others} today={props.today} t={props.t} onDone={close} onCancel={close} />
        </Modal>
      )}
    </>
  );
}

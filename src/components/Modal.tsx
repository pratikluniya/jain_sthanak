"use client";
// Small dialog: centred on laptops, a bottom sheet on phones. Escape or the backdrop closes it (unless locked).
import { useEffect } from "react";
import Icon from "./Icon";

export default function Modal(props: { title: string; subtitle?: string; onClose: () => void; closeLabel: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && props.onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [props]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={props.onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl ${props.wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl font-bold leading-snug">{props.title}</h2>
            {props.subtitle && <p className="text-sm text-stone-500">{props.subtitle}</p>}
          </div>
          <button type="button" onClick={props.onClose} className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100" aria-label={props.closeLabel}>
            <Icon name="close" />
          </button>
        </div>
        {props.children}
      </div>
    </div>
  );
}

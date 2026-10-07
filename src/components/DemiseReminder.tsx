"use client";
// Every 15 days Admin and Operator see this on the dashboard: who was marked deceased recently,
// and a search to mark anyone else right here. "Done" restarts the 15 days; "Later" hides it until tomorrow.
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import DeceasedForm, { type DeceasedLabels } from "./DeceasedForm";
import { demiseDoneAction, demiseLaterAction, searchForDemise, type DemiseCandidate } from "@/app/(app)/deceasedActions";

export interface RecentDemise {
  id: string;
  name: string;
  familyCode: string;
  dateOfDeath: string | null;
  markedBy: string;
}

export default function DemiseReminder(props: {
  recent: RecentDemise[];
  english: boolean;
  today: string;
  t: DeceasedLabels & {
    close: string; demiseTitle: string; demiseIntro: string; demiseRecent: string; demiseNone: string; markedBy: string;
    searchMember: string; demiseDone: string; demiseLater: string; markedDone: string; family: string; isHead: string; name: string;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<DemiseCandidate[]>([]);
  const [picked, setPicked] = useState<DemiseCandidate | null>(null);
  const [justMarked, setJustMarked] = useState("");
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // search as you type, after a short pause
  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setFound([]);
      return;
    }
    timer.current = setTimeout(() => {
      searchForDemise(q, props.english).then(setFound).catch(() => setFound([]));
    }, 300);
  }, [q, props.english]);

  const later = useCallback(() => {
    setOpen(false);
    start(() => demiseLaterAction());
  }, []);
  const done = () => {
    setOpen(false);
    start(() => demiseDoneAction());
  };
  const marked = useCallback(() => {
    setJustMarked(picked?.name ?? "");
    setPicked(null);
    setQ("");
    router.refresh(); // reload the "last 15 days" list
  }, [picked, router]);
  const cancelPick = useCallback(() => setPicked(null), []);

  if (!open) return null;
  const t = props.t;

  return (
    <Modal title={t.demiseTitle} subtitle={t.demiseIntro} onClose={later} closeLabel={t.close} wide>
      <section className="mb-4">
        <h3 className="section-title mb-2 text-base">{t.demiseRecent}</h3>
        {props.recent.length === 0 ? (
          <p className="text-sm text-stone-500">{t.demiseNone}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-stone-200">
            <table className="table">
              <thead>
                <tr><th>{t.name}</th><th>{t.family}</th><th>{t.dateOfDeath}</th><th>{t.markedBy}</th></tr>
              </thead>
              <tbody>
                {props.recent.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.name}</td>
                    <td className="whitespace-nowrap">{r.familyCode}</td>
                    <td className="whitespace-nowrap">{r.dateOfDeath ?? "—"}</td>
                    <td>{r.markedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mb-5 space-y-2">
        {justMarked && <p className="text-sm text-green-700" role="status">✔ {justMarked}: {t.markedDone}</p>}
        {picked ? (
          <div className="rounded-xl border border-stone-200 p-3">
            <DeceasedForm
              key={picked.id}
              member={{ id: picked.id, name: `${picked.name} · ${picked.familyCode}`, isHead: picked.isHead }}
              others={picked.others}
              today={props.today}
              t={t}
              onDone={marked}
              onCancel={cancelPick}
            />
          </div>
        ) : (
          <>
            <label htmlFor="demise-search" className="label">{t.searchMember}</label>
            <input id="demise-search" className="input" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" placeholder={t.searchMember} />
            {found.length > 0 && (
              <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
                {found.map((c) => (
                  <li key={c.id}>
                    <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-stone-50" onClick={() => setPicked(c)}>
                      <span>
                        <span className="font-medium">{c.name}</span>
                        {c.isHead && <span className="badge-gray ml-2">{t.isHead}</span>}
                        <span className="block text-xs text-stone-500">{c.familyCode} · {c.familyHead}</span>
                      </span>
                      <span className="btn-secondary btn-sm shrink-0">{t.markDeceased}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <div className="flex flex-wrap gap-2 border-t border-stone-100 pt-4">
        <button type="button" className="btn-primary" onClick={done} disabled={pending}>✔ {t.demiseDone}</button>
        <button type="button" className="btn-secondary" onClick={later} disabled={pending}>{t.demiseLater}</button>
      </div>
    </Modal>
  );
}

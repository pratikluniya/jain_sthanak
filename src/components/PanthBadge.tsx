// A panth in its own colour; families not yet confirmed also get the amber "to verify" tag.
import type { Panth, PanthStatus } from "@prisma/client";
import { PANTH_BADGE } from "@/lib/panth";

export default function PanthBadge({ panth, status, t }: { panth: Panth; status?: PanthStatus; t: { toVerify: string } & Record<Panth, string> }) {
  const toVerify = status === "TO_VERIFY";
  if (toVerify && panth === "UNKNOWN") return <span className="badge-amber">{t.toVerify}</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      <span className={PANTH_BADGE[panth]}>{t[panth]}</span>
      {toVerify && <span className="badge-amber">{t.toVerify}</span>}
    </span>
  );
}

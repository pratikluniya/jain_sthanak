import Link from "next/link";
import { prisma } from "@/lib/db";
import { getDict } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import type { ExtractedForm } from "@/lib/extract";
import { formImageUrls } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function UploadList() {
  await requireSession("upload");
  const t = getDict();
  const pending = await prisma.formUpload.findMany({
    where: { status: { in: ["EXTRACTED", "FAILED", "UPLOADED"] } },
    orderBy: { createdAt: "asc" },
  });
  const thumbs = await formImageUrls(pending.map((u) => u.imageKeys[0]).filter(Boolean));
  const thumbOf = new Map(pending.filter((u) => u.imageKeys[0]).map((u, i) => [u.id, thumbs[i]]));
  const done = await prisma.formUpload.count({ where: { status: "VERIFIED" } });
  const cost = await prisma.formUpload.aggregate({ _sum: { aiCostUsd: true } });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t.upload}</h1>
        <Link href="/upload/new" className="btn-primary">📷 {t.uploadForm}</Link>
      </div>
      <p className="text-sm text-stone-500">
        ✔ {done} · AI ≈ ${(cost._sum.aiCostUsd ?? 0).toFixed(2)}
      </p>
      <h2 className="font-semibold">{t.pendingUploads} ({pending.length})</h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {pending.map((u) => {
          const x = u.extracted as unknown as ExtractedForm | null;
          return (
            <li key={u.id}>
              <Link href={`/upload/${u.id}`} className="card p-3 flex gap-3 hover:border-brand-500">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {thumbOf.get(u.id) && <img src={thumbOf.get(u.id)} alt="" loading="lazy" className="h-20 w-16 object-cover rounded border" />}
                <div className="min-w-0 text-sm">
                  <div className="font-semibold truncate">{x?.headName || "नवीन फॉर्म"}</div>
                  <div className="text-stone-500">{x ? `${x.members.length} ${t.members}` : "✍ manual"}</div>
                  <div className="text-xs text-stone-400">{u.createdAt.toLocaleString("en-IN")} · {u.uploadedBy}</div>
                  {u.status === "FAILED" && <div className="badge-red mt-1">{u.error?.slice(0, 60)}</div>}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

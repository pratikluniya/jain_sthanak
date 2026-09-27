"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Page {
  file: File;
  url: string;
  rotation: number; // degrees clockwise: 0, 90, 180, 270
}

const MAX_SIDE = 2200;

/** Resize to max 2200px, apply rotation, return JPEG blob. Keeps uploads small on mobile data. */
async function prepare(p: Page): Promise<Blob> {
  const bmp = await createImageBitmap(p.file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const swap = p.rotation % 180 !== 0;
  const canvas = document.createElement("canvas");
  canvas.width = swap ? h : w;
  canvas.height = swap ? w : h;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((p.rotation * Math.PI) / 180);
  ctx.drawImage(bmp, -w / 2, -h / 2, w, h);
  return new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.85));
}

export default function Uploader({ t }: { t: Record<"takePhoto" | "addPage" | "rotate" | "readForm" | "reading" | "delete", string> }) {
  const [pages, setPages] = useState<Page[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setPages((ps) => [...ps, ...files.map((f) => ({ file: f, url: URL.createObjectURL(f), rotation: 0 }))].slice(0, 4));
    e.target.value = "";
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      for (const p of pages) fd.append("pages", await prepare(p), "page.jpg");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || res.statusText);
      router.push(`/upload/${j.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {pages.map((p, i) => (
          <div key={p.url} className="card p-2 space-y-2">
            <div className="aspect-[3/4] overflow-hidden flex items-center justify-center bg-stone-100 rounded">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={`page ${i + 1}`} style={{ transform: `rotate(${p.rotation}deg)` }} className="max-h-full max-w-full object-contain transition" />
            </div>
            <div className="flex gap-1 justify-between">
              <button type="button" className="btn-secondary btn-sm" onClick={() => setPages((ps) => ps.map((x, j) => (j === i ? { ...x, rotation: (x.rotation + 90) % 360 } : x)))}>
                ↻ {t.rotate}
              </button>
              <button type="button" className="btn-sm text-red-600" onClick={() => setPages((ps) => ps.filter((_, j) => j !== i))}>{t.delete}</button>
            </div>
          </div>
        ))}
      </div>
      {pages.length < 4 && (
        <label className="btn-secondary w-full py-4 cursor-pointer">
          📷 {pages.length === 0 ? t.takePhoto : t.addPage}
          <input type="file" accept="image/*" multiple={pages.length === 0} className="hidden" onChange={onPick} />
        </label>
      )}
      {pages.length > 0 && (
        <button className="btn-primary w-full py-3" disabled={busy} onClick={submit}>
          {busy ? t.reading : t.readForm}
        </button>
      )}
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}

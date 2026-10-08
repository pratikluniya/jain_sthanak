"use client";
import { useState } from "react";

interface Item {
  images: string[];
  photo?: string;
  kyc?: { image: string }[];
  form: { headName?: string };
}

export default function ImportForm() {
  const [batch, setBatch] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function readJson(f: File | undefined) {
    if (!f) return;
    try {
      const parsed = JSON.parse(await f.text());
      if (!Array.isArray(parsed)) throw new Error("forms.json must be a list");
      setItems(parsed);
      setLog([`forms.json: ${parsed.length} forms`]);
    } catch (e) {
      setLog([`forms.json: ${e instanceof Error ? e.message : e}`]);
    }
  }

  const byName = new Map(photos.map((p) => [p.name, p]));
  const missing = items.flatMap((it) => [...it.images, ...(it.kyc ?? []).map((k) => k.image), ...(it.photo ? [it.photo] : [])]).filter((n) => !byName.has(n));

  async function run() {
    setBusy(true);
    const out: string[] = [];
    for (const [i, it] of items.entries()) {
      const fd = new FormData();
      fd.set("batch", batch);
      fd.set("item", JSON.stringify(it));
      for (const n of [...it.images, ...(it.kyc ?? []).map((k) => k.image), ...(it.photo ? [it.photo] : [])]) {
        const f = byName.get(n);
        if (f) fd.append("files", f, n);
      }
      const label = `${i + 1}/${items.length} ${it.images.join("+")}`;
      try {
        const res = await fetch("/api/import", { method: "POST", body: fd });
        const j = await res.json();
        if (!res.ok) out.push(`✖ ${label}: ${j.error}`);
        else if (j.status === "skipped") out.push(`· ${label}: already imported`);
        else out.push(`✔ ${label}: ${j.headName} (${j.members} members, ${j.kyc} KYC)${j.warnings?.length ? " ⚠ " + j.warnings.join("; ") : ""}`);
      } catch (e) {
        out.push(`✖ ${label}: ${e instanceof Error ? e.message : e}`);
      }
      setLog([...out]);
    }
    setBusy(false);
  }

  return (
    <div className="card p-4 space-y-3">
      <div>
        <label className="label">Batch name</label>
        <input className="input" placeholder="forms-batch-02" value={batch} onChange={(e) => setBatch(e.target.value.trim())} />
      </div>
      <div>
        <label className="label">forms.json</label>
        <input type="file" accept="application/json,.json" onChange={(e) => readJson(e.target.files?.[0])} />
      </div>
      <div>
        <label className="label">Photos</label>
        <input type="file" accept="image/*" multiple onChange={(e) => setPhotos(Array.from(e.target.files ?? []))} />
        <p className="text-xs text-stone-500 mt-1">{photos.length} photos chosen</p>
      </div>
      {missing.length > 0 && <p className="text-sm text-red-600">Missing photos: {missing.join(", ")}</p>}
      <button className="btn-primary" disabled={busy || !batch || items.length === 0 || missing.length > 0} onClick={run}>
        {busy ? "Importing..." : `Import ${items.length} forms`}
      </button>
      {log.length > 0 && <pre className="text-xs bg-stone-50 border rounded p-2 whitespace-pre-wrap">{log.join("\n")}</pre>}
    </div>
  );
}

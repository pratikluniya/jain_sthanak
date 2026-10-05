"use client";
// File picker for scans and photos. On a phone it offers the camera or the gallery.
// Pictures are made smaller in the browser before upload (PDFs are sent as they are),
// so a 5 MB phone photo becomes a few hundred KB.
import { useRef, useState } from "react";

async function shrink(file: File, maxSide: number): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // e.g. HEIC the browser cannot draw: send the original
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function ImageInput(props: {
  name: string;
  label: string;
  /** longest side in pixels after shrinking */
  maxSide: number;
  allowPdf?: boolean;
  /** link to the file already saved, if any */
  currentUrl?: string;
  t: { uploaded: string; replaceFile: string };
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [info, setInfo] = useState("");

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const small = await shrink(f, props.maxSide);
    if (small !== f && input.current) {
      const dt = new DataTransfer();
      dt.items.add(small);
      input.current.files = dt.files;
    }
    setPreview(small.type.startsWith("image/") ? URL.createObjectURL(small) : null);
    setInfo(`${small.name} · ${Math.round(small.size / 1024)} KB`);
  }

  return (
    <div className="rounded-xl border border-stone-200 p-3">
      <label htmlFor={props.name} className="label">{props.label}</label>
      <div className="flex items-center gap-3">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-16 w-16 rounded-lg object-cover" />
        ) : props.currentUrl ? (
          <a href={props.currentUrl} target="_blank" rel="noopener" className="badge-green shrink-0">✔ {props.t.uploaded}</a>
        ) : null}
        <input
          ref={input}
          id={props.name}
          name={props.name}
          type="file"
          accept={props.allowPdf ? "image/*,application/pdf" : "image/*"}
          onChange={onChange}
          className="min-w-0 text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700"
        />
      </div>
      {info && <p className="mt-1 text-xs text-stone-500">{info}</p>}
      {props.currentUrl && !info && <p className="mt-1 text-xs text-stone-500">{props.t.replaceFile}</p>}
    </div>
  );
}

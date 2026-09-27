import { getDict } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import Uploader from "./Uploader";

export default async function NewUpload() {
  await requireSession("upload");
  const t = getDict();
  return (
    <div className="space-y-3 max-w-2xl">
      <h1 className="text-xl font-bold">{t.uploadForm}</h1>
      <Uploader t={{ takePhoto: t.takePhoto, addPage: t.addPage, rotate: t.rotate, readForm: process.env.ANTHROPIC_API_KEY ? t.readForm : t.upload, reading: process.env.ANTHROPIC_API_KEY ? t.reading : "...", delete: t.delete }} />
    </div>
  );
}

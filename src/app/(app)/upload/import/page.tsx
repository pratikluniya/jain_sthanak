import { requireSession } from "@/lib/session";
import ImportForm from "./ImportForm";

// Admin only: import a batch of forms read outside the app (forms.json + photos).
export default async function ImportPage() {
  await requireSession("settings");
  return (
    <div className="space-y-3 max-w-2xl">
      <h1 className="text-xl font-bold">Import batch</h1>
      <p className="text-sm text-stone-600">
        Choose the batch folder&apos;s <b>forms.json</b> and all its photos (F1.jpg, F1_1.jpg ...). Each form goes to the check queue;
        nothing is saved to families without a volunteer&apos;s check. Importing the same batch twice skips forms already imported.
      </p>
      <ImportForm />
    </div>
  );
}

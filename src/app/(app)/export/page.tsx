import { getDict } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import { DEFAULT_FIELDS, FIELDS, FIELD_LABEL, type ListKind } from "@/lib/exportRows";
import ExportForm from "./ExportForm";

export default async function ExportPage({ searchParams }: { searchParams: { list?: string } }) {
  await requireSession("export");
  const t = getDict();
  const list: ListKind = searchParams.list === "members" ? "members" : "voters";
  return (
    <div className="space-y-3 max-w-2xl">
      <h1 className="text-xl font-bold">{t.exports}</h1>
      <ExportForm
        initialList={list}
        fields={FIELDS.map((f) => ({ key: f, label: FIELD_LABEL[f] }))}
        defaults={DEFAULT_FIELDS}
        t={{ voterList: t.voterList, allMembers: t.allMembers, chooseFields: t.chooseFields, downloadExcel: t.downloadExcel, printPdf: t.printPdf }}
      />
    </div>
  );
}

// Everything the Download popup needs for one list, in the screen language.
import { LANGS, LANG_NAMES, type Dict, type Lang } from "./i18n";
import { DEFAULT_FIELDS, fieldLabels, fieldsFor, type ListKind } from "./exportRows";

export function downloadProps(list: ListKind, t: Dict, lang: Lang) {
  const labels = fieldLabels(t);
  return {
    list,
    title: list === "voters" ? t.voterList : list === "families" ? t.headList : t.allMembers,
    fields: fieldsFor(list).map((f) => ({ key: f, label: labels[f] })),
    defaults: [...DEFAULT_FIELDS[list]],
    langs: LANGS.map((l) => ({ code: l, label: LANG_NAMES[l] })),
    initialLang: lang,
    t: {
      download: t.download, downloadTitle: t.downloadTitle, chooseFields: t.chooseFields, exportLanguage: t.exportLanguage,
      downloadExcel: t.downloadExcel, printList: t.printList, downloadPdf: t.downloadPdf, pdfNote: t.pdfNote,
      defaultColumns: t.defaultColumns, pickOneColumn: t.pickOneColumn, close: t.close,
    },
  };
}

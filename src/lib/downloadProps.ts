// Everything the Download popup needs for one list, in the screen language.
// filters: the tab and search on screen (7 Nov 2026), so Excel / Print / PDF give exactly the rows on screen.
import { LANGS, LANG_NAMES, type Dict, type Lang } from "./i18n";
import { EMPTY_FILTERS, defaultFieldsFor, describe, fieldLabels, fieldsFor, filterQuery, type ExportFilters, type ListKind } from "./exportRows";

export function downloadProps(list: ListKind, t: Dict, lang: Lang, filters: Partial<ExportFilters> = {}) {
  const labels = fieldLabels(t);
  const f = { ...EMPTY_FILTERS, ...filters };
  return {
    list,
    title: describe(list, f, t),
    extraQuery: filterQuery(list, filters),
    fields: fieldsFor(list).map((k) => ({ key: k, label: labels[k] })),
    defaults: [...defaultFieldsFor(list, filters)],
    langs: LANGS.map((l) => ({ code: l, label: LANG_NAMES[l] })),
    initialLang: lang,
    t: {
      download: t.download, downloadTitle: t.downloadTitle, chooseFields: t.chooseFields, exportLanguage: t.exportLanguage,
      downloadExcel: t.downloadExcel, printList: t.printList, downloadPdf: t.downloadPdf, pdfNote: t.pdfNote,
      defaultColumns: t.defaultColumns, pickOneColumn: t.pickOneColumn, close: t.close,
    },
  };
}

// When the head of a family changes (death or moving out), every member's relation is rewritten as seen from
// the new head (decided 19 Nov 2026: change all automatically, best guess, no review step).
//
// Best guess uses the Marathi naming custom: a child's middle name is the father's first name, and a married
// woman's middle name is her husband's first name. So, when the son becomes head, a grandson whose middle name is
// the new head's first name becomes his son, any other grandson becomes his nephew. A relation with no option in
// the app (uncle, cousin, sister's husband's family ...) becomes "Other" for a volunteer to fix by hand.
import { searchKey } from "./normalize";
import { genderFromRelation } from "./relations";

export interface Person {
  relation: string; // relation to the OLD head ("SELF" for the old head)
  gender: string; // MALE / FEMALE / UNKNOWN
  firstName: string;
  middleName: string;
}

/** Same first name, allowing "जी"/"ji" endings and "सुनिल" vs "सुनिलकुमार". */
export function sameName(a: string, b: string): boolean {
  const k = (s: string) => searchKey(s).replace(/\s+/g, "").replace(/(जि|जी|ji)$/u, "");
  const x = k(a);
  const y = k(b);
  if (x.length < 2 || y.length < 2) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 3 && long.startsWith(short) && /^(कुमार|kumar|लाल|lal|चंद|chand|भाई|bhai)$/u.test(long.slice(short.length));
}

const male = (p: Person) => {
  const g = p.gender === "MALE" || p.gender === "FEMALE" ? p.gender : genderFromRelation(p.relation);
  return g === "MALE" ? true : g === "FEMALE" ? false : null;
};
/** Pick by gender; unknown gender gives "OTHER". */
const by = (p: Person, m: string, f: string) => (male(p) === true ? m : male(p) === false ? f : "OTHER");

/** The relation of `p` to the new head `h` (both relations given as they were to the old head). */
export function relationToNewHead(h: Person, p: Person): string {
  const o = p.relation;
  const childOfHead = sameName(p.middleName, h.firstName); // h is the father
  const wifeOfHead = sameName(p.middleName, h.firstName); // h is the husband
  const husbandOfHead = sameName(p.firstName, h.middleName); // p is h's husband (h a woman)
  const childOfHeadsHusband = h.middleName ? sameName(p.middleName, h.middleName) : false; // h a married woman: her children

  switch (h.relation) {
    case "WIFE":
    case "HUSBAND": {
      // the spouse becomes head: children and grandchildren stay as they are, the old head's family become in-laws
      const keep = ["SON", "DAUGHTER", "DAUGHTER_IN_LAW", "SON_IN_LAW", "GRANDSON", "GRANDDAUGHTER", "GRANDDAUGHTER_IN_LAW", "NEPHEW", "NIECE"];
      if (o === "SELF") return h.relation === "WIFE" ? "HUSBAND" : "WIFE";
      if (keep.includes(o)) return o;
      if (o === "FATHER") return "FATHER_IN_LAW";
      if (o === "MOTHER") return "MOTHER_IN_LAW";
      if (o === "BROTHER") return "BROTHER_IN_LAW";
      return "OTHER";
    }
    case "SON":
    case "DAUGHTER": {
      const son = h.relation === "SON";
      if (o === "SELF") return by(p, "FATHER", "MOTHER");
      if (o === "WIFE") return "MOTHER";
      if (o === "HUSBAND") return "FATHER";
      if (o === "SON") return son ? "BROTHER" : husbandOfHead ? "HUSBAND" : "BROTHER";
      if (o === "DAUGHTER") return "SISTER";
      if (o === "FATHER") return "GRANDFATHER";
      if (o === "MOTHER") return "GRANDMOTHER";
      if (o === "DAUGHTER_IN_LAW") return son && wifeOfHead ? "WIFE" : "SISTER_IN_LAW";
      if (o === "SON_IN_LAW") return !son && husbandOfHead ? "HUSBAND" : "BROTHER_IN_LAW";
      if (o === "GRANDSON" || o === "GRANDDAUGHTER") {
        const own = son ? childOfHead : childOfHeadsHusband;
        return o === "GRANDSON" ? (own ? "SON" : "NEPHEW") : own ? "DAUGHTER" : "NIECE";
      }
      return "OTHER";
    }
    case "DAUGHTER_IN_LAW": {
      // a son's wife becomes head (her husband died or moved out)
      if (o === "SELF") return by(p, "FATHER_IN_LAW", "MOTHER_IN_LAW");
      if (o === "WIFE") return "MOTHER_IN_LAW";
      if (o === "HUSBAND") return "FATHER_IN_LAW";
      if (o === "SON") return husbandOfHead ? "HUSBAND" : "BROTHER_IN_LAW";
      if (o === "GRANDSON") return childOfHeadsHusband ? "SON" : "NEPHEW";
      if (o === "GRANDDAUGHTER") return childOfHeadsHusband ? "DAUGHTER" : "NIECE";
      return "OTHER";
    }
    case "BROTHER":
    case "SISTER": {
      const brother = h.relation === "BROTHER";
      if (o === "SELF") return by(p, "BROTHER", "SISTER");
      if (o === "BROTHER" || o === "SISTER" || o === "FATHER" || o === "MOTHER") return o;
      if (o === "WIFE") return "SISTER_IN_LAW";
      if (o === "HUSBAND") return "BROTHER_IN_LAW";
      if (o === "SON") return "NEPHEW";
      if (o === "DAUGHTER") return "NIECE";
      if (o === "SISTER_IN_LAW") return brother && wifeOfHead ? "WIFE" : "SISTER_IN_LAW";
      if (o === "NEPHEW") return (brother ? childOfHead : childOfHeadsHusband) ? "SON" : "NEPHEW";
      if (o === "NIECE") return (brother ? childOfHead : childOfHeadsHusband) ? "DAUGHTER" : "NIECE";
      return "OTHER";
    }
    case "GRANDSON": {
      if (o === "SELF") return by(p, "GRANDFATHER", "GRANDMOTHER");
      if (o === "WIFE") return "GRANDMOTHER";
      if (o === "HUSBAND") return "GRANDFATHER";
      if (o === "SON") return sameName(p.firstName, h.middleName) ? "FATHER" : "OTHER";
      if (o === "DAUGHTER_IN_LAW") return sameName(p.middleName, h.middleName) ? "MOTHER" : "OTHER";
      if (o === "GRANDSON") return sameName(p.middleName, h.middleName) ? "BROTHER" : "OTHER";
      if (o === "GRANDDAUGHTER") return sameName(p.middleName, h.middleName) ? "SISTER" : "OTHER";
      if (o === "GRANDDAUGHTER_IN_LAW") return wifeOfHead ? "WIFE" : "OTHER";
      return "OTHER";
    }
    case "FATHER":
    case "MOTHER": {
      // the old head's parent becomes head
      if (o === "SELF") return by(p, "SON", "DAUGHTER");
      if (o === "WIFE") return "DAUGHTER_IN_LAW";
      if (o === "SON") return "GRANDSON";
      if (o === "DAUGHTER") return "GRANDDAUGHTER";
      if (o === "DAUGHTER_IN_LAW") return "GRANDDAUGHTER_IN_LAW";
      if (o === "BROTHER") return "SON";
      if (o === "SISTER") return "DAUGHTER";
      if (o === "SISTER_IN_LAW") return "DAUGHTER_IN_LAW";
      if (o === "NEPHEW") return "GRANDSON";
      if (o === "NIECE") return "GRANDDAUGHTER";
      if (o === "MOTHER" && h.relation === "FATHER") return "WIFE";
      if (o === "FATHER" && h.relation === "MOTHER") return "HUSBAND";
      return "OTHER";
    }
    default:
      return "OTHER";
  }
}

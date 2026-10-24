// Duplicate report (decided 24 Oct 2026): finds likely duplicates inside the live data so an Admin or
// Operator can check them family by family. Nothing is changed automatically.
//   SAME_PERSON_2_FAMILIES  same first name + surname, and the same mobile or the same father's/husband's name
//   SAME_FAMILY_TWICE        same head (first name + surname, and middle name or mobile or address), or same
//                            address plus a shared mobile
//   SAME_PERSON_IN_FAMILY    same first name + surname twice in one family (and same middle name or none)
//   SHARED_MOBILE            one mobile on members of different families with different names (often a
//                            family phone: listed to check, not as a duplicate)
// Spellings are folded with searchKey (ण=न, ी=ि, titles and "जी" ignored), Marathi or English names.
import { searchKey } from "./normalize";

export type DupKind = "SAME_PERSON_2_FAMILIES" | "SAME_FAMILY_TWICE" | "SAME_PERSON_IN_FAMILY" | "SHARED_MOBILE";

export interface DupMember {
  id: string;
  firstName: string;
  middleName: string;
  surname: string;
  firstNameEn: string;
  surnameEn: string;
  mobile: string;
}

export interface DupFamily {
  id: string;
  code: string;
  headName: string;
  address: string;
  members: DupMember[];
}

export interface DupSide {
  familyId: string;
  code: string;
  headName: string;
  memberId?: string;
  name?: string;
}

export interface DupPair {
  kind: DupKind;
  a: DupSide;
  b: DupSide;
  why: string[]; // "mobile 98...", "father/husband", "address", "head"
}

const k = (s: string) => searchKey(s ?? "").replace(/\s+/g, "");
const words = (s: string) => searchKey(s ?? "").split(" ").filter((w) => w.length > 1);
const mob = (s: string) => (/^\d{10}$/.test(s ?? "") ? s : "");
const nameOf = (m: DupMember) => [m.firstName, m.middleName, m.surname].filter(Boolean).join(" ");

function personKeys(m: DupMember): string[] {
  const out: string[] = [];
  if (k(m.firstName) && k(m.surname)) out.push(`${k(m.firstName)}|${k(m.surname)}`);
  if (k(m.firstNameEn) && k(m.surnameEn)) out.push(`en:${k(m.firstNameEn)}|${k(m.surnameEn)}`);
  return out;
}

const side = (f: DupFamily, m?: DupMember): DupSide => ({ familyId: f.id, code: f.code, headName: f.headName, ...(m ? { memberId: m.id, name: nameOf(m) } : {}) });

export function findDuplicates(families: DupFamily[]): DupPair[] {
  const out: DupPair[] = [];
  const seen = new Set<string>();
  const add = (p: DupPair) => {
    const ids = [p.a.memberId ?? p.a.familyId, p.b.memberId ?? p.b.familyId].sort().join("~");
    const key = `${p.kind}:${ids}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(p);
  };

  // people by first name + surname
  const byPerson = new Map<string, { f: DupFamily; m: DupMember }[]>();
  for (const f of families) for (const m of f.members) for (const key of personKeys(m)) {
    const list = byPerson.get(key) ?? [];
    list.push({ f, m });
    byPerson.set(key, list);
  }
  const personPairs = new Set<string>();
  for (const list of byPerson.values()) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const x = list[i], y = list[j];
      if (x.m.id === y.m.id) continue;
      const sameMobile = !!mob(x.m.mobile) && mob(x.m.mobile) === mob(y.m.mobile);
      const sameMiddle = !!k(x.m.middleName) && k(x.m.middleName) === k(y.m.middleName);
      if (x.f.id === y.f.id) {
        if (sameMiddle || !k(x.m.middleName) || !k(y.m.middleName) || sameMobile) {
          add({ kind: "SAME_PERSON_IN_FAMILY", a: side(x.f, x.m), b: side(y.f, y.m), why: [sameMobile ? `mobile ${x.m.mobile}` : "", sameMiddle ? "father/husband" : ""].filter(Boolean) });
        }
      } else if (sameMobile || sameMiddle) {
        add({ kind: "SAME_PERSON_2_FAMILIES", a: side(x.f, x.m), b: side(y.f, y.m), why: [sameMobile ? `mobile ${x.m.mobile}` : "", sameMiddle ? "father/husband" : ""].filter(Boolean) });
        personPairs.add([x.m.id, y.m.id].sort().join("~"));
      }
    }
  }

  // families twice
  for (let i = 0; i < families.length; i++) for (let j = i + 1; j < families.length; j++) {
    const a = families[i], b = families[j];
    const ha = words(a.headName), hb = words(b.headName);
    const sameHead = ha.length >= 2 && hb.length >= 2 && ha[0] === hb[0] && (ha.includes(hb[hb.length - 1]) || hb.includes(ha[ha.length - 1]));
    const mobA = new Set(a.members.map((m) => mob(m.mobile)).filter(Boolean));
    const shared = b.members.map((m) => mob(m.mobile)).find((x) => x && mobA.has(x));
    const addrA = new Set(words(a.address).filter((w) => w.length > 2 && !/^\d+$/.test(w)));
    const addrHits = words(b.address).filter((w) => addrA.has(w)).length;
    const why: string[] = [];
    if (sameHead) why.push("head");
    if (shared) why.push(`mobile ${shared}`);
    if (addrHits >= 2) why.push("address");
    const sameHeadStrong = sameHead && (ha.slice(1, -1).some((w) => hb.includes(w)) || !!shared || addrHits >= 2 || ha.length === 2 || hb.length === 2);
    if (sameHeadStrong || (shared && addrHits >= 2)) add({ kind: "SAME_FAMILY_TWICE", a: side(a), b: side(b), why });
  }

  // one mobile on different people in different families (not already a same-person pair)
  const byMobile = new Map<string, { f: DupFamily; m: DupMember }[]>();
  for (const f of families) for (const m of f.members) {
    const x = mob(m.mobile);
    if (!x) continue;
    byMobile.set(x, [...(byMobile.get(x) ?? []), { f, m }]);
  }
  for (const [num, list] of byMobile) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const x = list[i], y = list[j];
      if (x.f.id === y.f.id || personPairs.has([x.m.id, y.m.id].sort().join("~"))) continue;
      add({ kind: "SHARED_MOBILE", a: side(x.f, x.m), b: side(y.f, y.m), why: [`mobile ${num}`] });
    }
  }
  const order: DupKind[] = ["SAME_FAMILY_TWICE", "SAME_PERSON_2_FAMILIES", "SAME_PERSON_IN_FAMILY", "SHARED_MOBILE"];
  return out.sort((p, q) => order.indexOf(p.kind) - order.indexOf(q.kind) || p.a.code.localeCompare(q.a.code));
}

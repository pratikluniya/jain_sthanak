// Public voter search (/search, no login). Only people on the current voter list can be found.
// Rules (decided 23 Oct 2026, replacing the 7 Oct "first name + surname" rule):
// - One word of 4+ letters is enough ("Pratik", "प्रतिक", "Luniya"); two words of 2+ letters also work.
//   Letters of a Marathi word are counted on its English spelling, so "जैन" counts like "Jain".
// - Every typed word must match the START of a word in the person's name (Marathi or English),
//   so "Prat" finds Pratik but "tik" does not.
// - Names only: mobile numbers and family codes never match here (they do on logged-in screens).
import { searchKey } from "./normalize";
import { toEnglishName } from "./translit";
import { evaluateAll, sortBySurname, surnameFirstName } from "./members";
import { familyAddress } from "./addressEn";
import type { Member } from "@prisma/client";

export const MIN_SINGLE_WORD = 4;

export function queryWords(q: string): string[] {
  return searchKey(q).split(" ").filter((w) => w.length >= 2);
}

/** Letters in a word as a person would count them: Marathi words by their English spelling. */
export function letterCount(word: string): number {
  return /[ऀ-ॿ]/.test(word) ? toEnglishName(word).replace(/[^a-z]/gi, "").length : word.replace(/[^\p{L}]/gu, "").length;
}

/** Validity is judged on the words as typed (search form folds spellings: "Both" becomes "bot"). */
export const validQuery = (q: string) => {
  const typed = (q ?? "").normalize("NFC").split(/[\s.,;:।()\-_/]+/).filter((w) => letterCount(w) >= 2);
  return queryWords(q).length > 0 && (typed.length >= 2 || typed.some((x) => letterCount(x) >= MIN_SINGLE_WORD));
};

/** All name words of a member, Marathi and English, in search form. */
export function nameWords(m: Pick<Member, "firstName" | "middleName" | "surname" | "firstNameEn" | "middleNameEn" | "surnameEn">): string[] {
  return searchKey([m.firstName, m.middleName, m.surname, m.firstNameEn, m.middleNameEn, m.surnameEn].filter(Boolean).join(" "))
    .split(" ")
    .filter(Boolean);
}

/** Every typed word starts some word of the name. */
export function nameMatches(words: string[], query: string[]): boolean {
  return query.length > 0 && query.every((q) => words.some((w) => w.startsWith(q)));
}

export interface PublicHit {
  name: string;
  voterNo: number | null;
  address: string;
}

export async function publicVoterSearch(q: string, english: boolean): Promise<PublicHit[]> {
  if (!validQuery(q)) return [];
  const query = queryWords(q);
  const { rows } = await evaluateAll();
  const hits = rows.filter((r) => r.result.eligible && nameMatches(nameWords(r.member), query));
  return sortBySurname(hits).map((r) => ({ name: surnameFirstName(r.member, english), voterNo: r.member.voterNo, address: familyAddress(r.family, english) }));
}

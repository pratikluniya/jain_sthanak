// Public voter search (/search, no login). Only people on the current voter list can be found.
// The query must have at least two words of two letters or more (first name + surname, decided 7 Oct 2026),
// so typing only a surname does not list a whole family or community.
import { searchKey, matchesSearch } from "./normalize";
import { evaluateAll, memberFullName, sortBySurname } from "./members";

export function queryWords(q: string): string[] {
  return searchKey(q).split(" ").filter((w) => w.length >= 2);
}

export const validQuery = (q: string) => queryWords(q).length >= 2;

export interface PublicHit {
  name: string;
  voterNo: number | null;
  address: string;
}

export async function publicVoterSearch(q: string, english: boolean): Promise<PublicHit[]> {
  if (!validQuery(q)) return [];
  const words = queryWords(q).join(" ");
  const { rows } = await evaluateAll();
  const hits = rows.filter((r) => r.result.eligible && matchesSearch(r.member.searchKey, words));
  return sortBySurname(hits).map((r) => ({ name: memberFullName(r.member, true, english), voterNo: r.member.voterNo, address: r.family.address }));
}

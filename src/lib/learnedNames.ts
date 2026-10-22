// Server side: teaches toMarathi.ts the Marathi spelling of names the Sangh already has in both scripts
// (e.g. "Kantilal" -> कांतिलाल), so English-only entries get the family's usual spelling.
import { prisma } from "./db";
import { learnFromPairs, setLearnedNames } from "./toMarathi";

let loadedAt = 0;

/** Refresh the learned spellings at most every 10 minutes. Call before saving names. */
export async function loadLearnedNames(): Promise<void> {
  if (Date.now() - loadedAt < 10 * 60 * 1000) return;
  const [members, families] = await Promise.all([
    prisma.member.findMany({ where: { deletedAt: null }, select: { firstName: true, firstNameEn: true, middleName: true, middleNameEn: true, surname: true, surnameEn: true } }),
    prisma.family.findMany({ where: { deletedAt: null }, select: { headName: true, headNameEn: true } }),
  ]);
  const pairs: [string, string][] = [];
  for (const m of members) pairs.push([m.firstName, m.firstNameEn], [m.middleName, m.middleNameEn], [m.surname, m.surnameEn]);
  for (const f of families) pairs.push([f.headName, f.headNameEn]);
  setLearnedNames(learnFromPairs(pairs));
  loadedAt = Date.now();
}

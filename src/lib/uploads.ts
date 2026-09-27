import { prisma } from "./db";
import { extractForm, type ExtractedForm } from "./extract";
import { getFile } from "./storage";
import { searchKey } from "./normalize";
import { normalizeMobile } from "./normalize";

// [Unverified] price per million tokens for the chosen model; update from the Anthropic pricing page.
const USD_PER_MTOK_IN = Number(process.env.AI_PRICE_IN ?? 3);
const USD_PER_MTOK_OUT = Number(process.env.AI_PRICE_OUT ?? 15);

export async function runExtraction(uploadId: string) {
  const up = await prisma.formUpload.findUniqueOrThrow({ where: { id: uploadId } });
  try {
    const images = await Promise.all(
      up.imageKeys.map(async (k) => ({ base64: (await getFile("forms", k)).toString("base64"), mediaType: "image/jpeg" as const })),
    );
    const res = await extractForm(images);
    const cost = (res.inputTokens * USD_PER_MTOK_IN + res.outputTokens * USD_PER_MTOK_OUT) / 1_000_000;
    await prisma.formUpload.update({
      where: { id: uploadId },
      data: { status: "EXTRACTED", extracted: res.data as object, aiCostUsd: cost, error: null },
    });
  } catch (e) {
    await prisma.formUpload.update({
      where: { id: uploadId },
      data: { status: "FAILED", error: e instanceof Error ? e.message : String(e) },
    });
  }
}

export interface DuplicateCandidate {
  id: string;
  code: string;
  headName: string;
  address: string;
  reason: string;
}

/**
 * Families that may be the same as the form, best match first.
 * Score: same head first name +3, each other matching name word +1, shared mobile +5,
 * matching address words +1 each (max 3). Only families scoring 3 or more are shown.
 */
export async function findDuplicates(form: Pick<ExtractedForm, "headName" | "members"> & { address?: string }): Promise<DuplicateCandidate[]> {
  const headWords = searchKey(form.headName).split(" ").filter((w) => w.length > 1);
  const addrWords = new Set(searchKey(form.address ?? "").split(" ").filter((w) => w.length > 2));
  const mobiles = form.members.map((m) => normalizeMobile(m.mobile).value).filter((m) => m.length === 10);
  const families = await prisma.family.findMany({ include: { members: { select: { mobile: true } } } });
  const scored: (DuplicateCandidate & { score: number })[] = [];
  for (const f of families) {
    const fw = searchKey(f.headName).split(" ").filter((w) => w.length > 1);
    let score = 0;
    const reasons: string[] = [];
    if (headWords[0] && fw[0] === headWords[0]) score += 3;
    score += headWords.slice(1).filter((w) => fw.includes(w)).length;
    if (score >= 3) reasons.push("name");
    const shared = f.members.find((m) => m.mobile && mobiles.includes(m.mobile));
    if (shared) {
      score += 5;
      reasons.push(`mobile ${shared.mobile}`);
    }
    const fa = searchKey(f.address).split(" ").filter((w) => w.length > 2);
    const addrHits = Math.min(3, fa.filter((w) => addrWords.has(w)).length);
    score += addrHits;
    if (addrHits >= 2) reasons.push("address");
    if (score >= 3) scored.push({ id: f.id, code: f.code, headName: f.headName, address: f.address, reason: reasons.join(", "), score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ score: _s, ...d }) => d);
}

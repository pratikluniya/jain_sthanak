// Small preview photos (5 Nov 2026). Lists showed full 2,200 px form photos (300-500 KB each) as tiny previews.
// A preview is made the first time it is asked for, saved next to the photo under thumbs/<width>/..., and reused.
import { getFile, putFile } from "./storage";

export const THUMB_WIDTHS = [160, 320] as const;
export type ThumbWidth = (typeof THUMB_WIDTHS)[number];
type Bucket = "forms" | "photos";

export function thumbWidth(raw: string | null): ThumbWidth | null {
  const n = Number(raw);
  return (THUMB_WIDTHS as readonly number[]).includes(n) ? (n as ThumbWidth) : null;
}

export const thumbKey = (key: string, width: ThumbWidth) => `thumbs/${width}/${key}.webp`;

// The server has one processor: make at most two previews at a time; the same preview asked twice is made once.
const making = new Map<string, Promise<Buffer>>();
let running = 0;
const queue: (() => void)[] = [];
async function slot<T>(work: () => Promise<T>): Promise<T> {
  if (running >= 2) await new Promise<void>((r) => queue.push(r));
  running++;
  try {
    return await work();
  } finally {
    running--;
    queue.shift()?.();
  }
}

/** The preview of a stored image (made and saved on first use). */
export async function getThumb(bucket: Bucket, key: string, width: ThumbWidth): Promise<Buffer> {
  const tk = thumbKey(key, width);
  try {
    return await getFile(bucket, tk);
  } catch {
    /* not made yet */
  }
  const id = `${bucket}/${tk}`;
  const busy = making.get(id);
  if (busy) return busy;
  const job = slot(async () => {
    const { default: sharp } = await import("sharp");
    const original = await getFile(bucket, key);
    const out = await sharp(original, { failOn: "none" })
      .rotate() // follow the photo's own orientation tag
      .resize({ width, height: Math.round(width * 1.6), fit: "inside", withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer();
    await putFile(bucket, tk, out, "image/webp");
    return out;
  }).finally(() => making.delete(id));
  making.set(id, job);
  return job;
}

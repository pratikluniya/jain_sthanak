import { NextResponse } from "next/server";
import { getLiveSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { getFile } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { getThumb, thumbWidth } from "@/lib/thumbs";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };

export async function GET(req: Request, { params }: { params: { bucket: string; key: string[] } }) {
  const s = await getLiveSession();
  if (!s) return new NextResponse("Unauthorized", { status: 401 });
  const bucket = params.bucket;
  if (bucket !== "forms" && bucket !== "kyc" && bucket !== "photos") return new NextResponse("Not found", { status: 404 });
  // form photos and member photos: any logged-in user; Aadhaar scans: only roles that may see Aadhaar (every view logged)
  if ((bucket === "forms" || bucket === "photos") && !can(s.role, "view")) return new NextResponse("Forbidden", { status: 403 });
  if (bucket === "kyc" && !can(s.role, "viewAadhaar")) return new NextResponse("Forbidden", { status: 403 });
  const key = params.key.join("/");
  // ?w=160 / ?w=320: small preview of a form or member photo (5 Nov 2026); Aadhaar scans never get previews
  const w = bucket !== "kyc" && /\.(jpe?g|png|webp)$/i.test(key) ? thumbWidth(new URL(req.url).searchParams.get("w")) : null;
  if (w) {
    try {
      const data = await getThumb(bucket as "forms" | "photos", key, w);
      return new NextResponse(new Uint8Array(data), { headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=604800" } });
    } catch {
      /* preview could not be made: send the photo itself below */
    }
  }
  try {
    const data = await getFile(bucket, key);
    if (bucket === "kyc") await audit(s.uid, "view", "KycFile", key);
    const ext = key.split(".").pop()?.toLowerCase() ?? "";
    return new NextResponse(new Uint8Array(data), {
      headers: { "Content-Type": TYPES[ext] ?? "application/octet-stream", "Cache-Control": "private, max-age=300" },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

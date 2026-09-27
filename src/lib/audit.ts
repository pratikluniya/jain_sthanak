import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

export async function audit(userId: string | null, action: string, entity: string, entityId?: string | null, detail?: Prisma.InputJsonValue) {
  try {
    await prisma.auditLog.create({ data: { userId, action, entity, entityId: entityId ?? null, detail: detail ?? undefined } });
  } catch (e) {
    console.error("audit failed", e);
  }
}

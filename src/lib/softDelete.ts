// Soft delete: nothing is erased. "Deleted" records get deletedAt + deletedById and are hidden
// everywhere (lists, search, voter list, exports, duplicate check). Only Admin can see and restore them.
import { prisma } from "./db";

/** Prisma filter for records that are not deleted. */
export const LIVE = { deletedAt: null } as const;

/** Delete a family and, at the same moment, every member still in it. */
export async function softDeleteFamily(id: string, by: string) {
  const at = new Date();
  await prisma.$transaction([
    prisma.member.updateMany({ where: { familyId: id, deletedAt: null }, data: { deletedAt: at, deletedById: by } }),
    prisma.family.update({ where: { id }, data: { deletedAt: at, deletedById: by } }),
  ]);
}

/** Restore a family and the members that were deleted together with it (same moment); members deleted earlier stay deleted. */
export async function restoreFamily(id: string) {
  const fam = await prisma.family.findUniqueOrThrow({ where: { id } });
  if (!fam.deletedAt) return;
  await prisma.$transaction([
    prisma.member.updateMany({ where: { familyId: id, deletedAt: fam.deletedAt }, data: { deletedAt: null, deletedById: null } }),
    prisma.family.update({ where: { id }, data: { deletedAt: null, deletedById: null } }),
  ]);
}

export async function softDeleteMember(id: string, by: string) {
  return prisma.member.update({ where: { id }, data: { deletedAt: new Date(), deletedById: by } });
}

/** A member of a deleted family can only come back with the family. */
export async function restoreMember(id: string): Promise<"ok" | "familyDeleted"> {
  const m = await prisma.member.findUniqueOrThrow({ where: { id }, include: { family: { select: { deletedAt: true } } } });
  if (m.family.deletedAt) return "familyDeleted";
  await prisma.member.update({ where: { id }, data: { deletedAt: null, deletedById: null } });
  return "ok";
}

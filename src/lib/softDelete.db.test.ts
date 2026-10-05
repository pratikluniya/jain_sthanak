// Database test for soft delete: deleted families and members must never reach the voter list or exports.
// Needs a throw-away PostgreSQL database, so it runs only when asked:
//   RUN_DB_TESTS=1 npx tsx --test src/lib/softDelete.db.test.ts
// (npm test skips it; never point DATABASE_URL at the live database.)
import { test, after } from "node:test";
import assert from "node:assert/strict";

const run = process.env.RUN_DB_TESTS === "1";

test("soft-deleted families and members are left out of the voter list and exports", { skip: !run }, async () => {
  const { prisma } = await import("./db");
  const { evaluateAll } = await import("./members");
  const { buildExport } = await import("./exportRows");
  const { softDeleteFamily, restoreFamily, softDeleteMember, restoreMember } = await import("./softDelete");
  after(() => prisma.$disconnect());

  const fam = await prisma.family.create({
    data: { code: `T-${Date.now()}`, headName: "चाचणी कुटुंब", address: "test", panth: "STHANAKVASI", panthStatus: "CONFIRMED" },
  });
  const a = await prisma.member.create({ data: { familyId: fam.id, firstName: "अजय", surname: "चाचणी", age: 40, ageRecordedOn: new Date(), isHead: true, relation: "SELF" } });
  const b = await prisma.member.create({ data: { familyId: fam.id, firstName: "बीना", surname: "चाचणी", age: 38, ageRecordedOn: new Date(), relation: "WIFE" } });
  const ids = async () => new Set((await evaluateAll()).rows.filter((r) => r.result.eligible).map((r) => r.member.id));
  const exported = async () => (await buildExport("members", ["fullName", "familyCode"])).rows.filter((r) => r.includes(fam.code)).length;

  try {
    assert.ok((await ids()).has(a.id) && (await ids()).has(b.id), "both are voters before delete");
    assert.equal(await exported(), 2);

    // one member deleted
    await softDeleteMember(b.id, "test");
    assert.ok(!(await ids()).has(b.id), "deleted member not a voter");
    assert.equal(await exported(), 1);

    // whole family deleted: the other member goes with it
    await softDeleteFamily(fam.id, "test");
    const after1 = await ids();
    assert.ok(!after1.has(a.id) && !after1.has(b.id), "deleted family's members not voters");
    assert.equal(await exported(), 0);
    assert.equal(await restoreMember(a.id), "familyDeleted", "member of a deleted family cannot be restored alone");

    // family restored: only the member deleted WITH the family comes back
    await restoreFamily(fam.id);
    const after2 = await ids();
    assert.ok(after2.has(a.id), "member deleted with the family is back");
    assert.ok(!after2.has(b.id), "member deleted earlier stays deleted");
    assert.equal(await restoreMember(b.id), "ok");
    assert.equal(await exported(), 2);
  } finally {
    await prisma.member.deleteMany({ where: { familyId: fam.id } });
    await prisma.family.delete({ where: { id: fam.id } });
  }
});

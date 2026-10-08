// Database test for "moved out" (run: RUN_DB_TESTS=1 npx tsx --test src/lib/movedOut.db.test.ts; skipped by npm test).
import { test, after } from "node:test";
import assert from "node:assert/strict";

const run = process.env.RUN_DB_TESTS === "1";

test("moved-out members and families leave the voter list; family undo brings back only those who moved with it", { skip: !run }, async () => {
  const { prisma } = await import("./db");
  const { evaluateAll } = await import("./members");
  const { markFamilyMovedOut, markMemberMovedOut, undoFamilyMovedOut, undoMemberMovedOut } = await import("./movedOut");
  after(() => prisma.$disconnect());
  const fam = await prisma.family.create({ data: { code: `MV-${Date.now()}`, headName: "चाचणी", panth: "STHANAKVASI", panthStatus: "CONFIRMED" } });
  const mk = (firstName: string, isHead = false) =>
    prisma.member.create({ data: { familyId: fam.id, firstName, surname: "चाचणी", age: 40, ageRecordedOn: new Date(), isHead, relation: isHead ? "SELF" : "SON", gender: "MALE" } });
  const head = await mk("प्रमुख", true);
  const a = await mk("अजय");
  const b = await mk("बाळू");
  const voters = async () => new Set((await evaluateAll()).rows.filter((r) => r.result.eligible).map((r) => r.member.id));
  try {
    assert.deepEqual(await markMemberMovedOut({ memberId: a.id, date: "", by: "t" }), { ok: false, error: "dateRequired" });
    assert.deepEqual(await markMemberMovedOut({ memberId: head.id, date: "2026-10-01", by: "t" }), { ok: false, error: "mustChooseHead" });
    assert.deepEqual(await markMemberMovedOut({ memberId: a.id, date: "2026-10-01", city: "पुणे", by: "t" }), { ok: true });
    let v = await voters();
    assert.ok(!v.has(a.id) && v.has(b.id) && v.has(head.id), "only Ajay left the list");

    assert.deepEqual(await markFamilyMovedOut({ familyId: fam.id, date: "2026-10-05", by: "t" }), { ok: true });
    v = await voters();
    assert.ok(!v.has(head.id) && !v.has(b.id), "whole family left the list");
    assert.equal(await undoMemberMovedOut(b.id), "familyMovedOut", "member of a moved family cannot come back alone");

    await undoFamilyMovedOut(fam.id);
    v = await voters();
    assert.ok(v.has(head.id) && v.has(b.id), "family members back");
    assert.ok(!v.has(a.id), "Ajay moved on his own and stays moved");
    assert.equal(await undoMemberMovedOut(a.id), "ok");
    assert.ok((await voters()).has(a.id));
  } finally {
    await prisma.member.deleteMany({ where: { familyId: fam.id } });
    await prisma.family.delete({ where: { id: fam.id } });
  }
});

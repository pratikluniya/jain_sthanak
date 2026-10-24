// Database test for individual applications (run: RUN_DB_TESTS=1 npx tsx --test src/lib/applications.db.test.ts; skipped by npm test).
import { test, after } from "node:test";
import assert from "node:assert/strict";

const run = process.env.RUN_DB_TESTS === "1";

test("application joins an existing family as daughter-in-law, or starts a new family to verify", { skip: !run }, async () => {
  const { prisma } = await import("./db");
  const { evaluateAll } = await import("./members");
  const { saveApplication, suggestFamilies, applicationData } = await import("./applications");
  after(() => prisma.$disconnect());
  const stamp = Date.now();
  const fam = await prisma.family.create({ data: { code: `AP-${stamp}`, headName: "सुरेश ताराचंद झांबड", address: "जेल रोड नाशिक रोड", panth: "STHANAKVASI", panthStatus: "CONFIRMED" } });
  await prisma.member.create({ data: { familyId: fam.id, firstName: "सुरेश", middleName: "ताराचंद", surname: "झांबड", age: 55, ageRecordedOn: new Date(), isHead: true, relation: "SELF", gender: "MALE" } });
  await prisma.member.create({ data: { familyId: fam.id, firstName: "अंकित", middleName: "सुरेश", surname: "झांबड", age: 28, ageRecordedOn: new Date(), relation: "SON", gender: "MALE" } });
  const mkUpload = () => prisma.formUpload.create({ data: { kind: "INDIVIDUAL", imageKeys: [], status: "EXTRACTED", extracted: {}, uploadedBy: "test" } });
  const empty = applicationData({ appNo: "", appDate: "", homeAddress: "", businessAddress: "", email: "", landline: "", feeEntry: "", feeAnnual: "", feeLifetime: "", feeTotal: "", receiptNo: "", receiptDate: "", proposerName: "", proposerAddress: "", proposerMobile: "", proposerLandline: "", seconderName: "", seconderAddress: "", seconderMobile: "", seconderLandline: "", decision: "", meetingDate: "", rejectReasons: "", docs: [], notes: "" });
  const appFields = { ...Object.fromEntries(Object.keys(empty).map((k) => [k, ""])), docs: ["AADHAAR", "BOGUS"], appNo: "45", appDate: "12/05/2024", feeTotal: "₹ ५०१", decision: "APPROVED", homeAddress: "जेल रोड" } as never;
  const applicant = { title: "सौ.", firstName: "प्रिया", middleName: "अंकित", surname: "झांबड", firstNameEn: "", middleNameEn: "", surnameEn: "", nameRaw: "झांबड प्रिया अंकित", gender: "FEMALE", dob: "1998-03-04", age: "", mobile: "", occupation: "", education: "", bloodGroup: "" };
  const created: string[] = [];
  try {
    const s = await suggestFamilies({ surname: "झांबड", middleName: "अंकित", gender: "FEMALE", mobile: "", homeAddress: "जेल रोड" });
    const mine = s.find((x) => x.id === fam.id);
    assert.ok(mine, "family suggested");
    assert.equal(mine!.relation, "DAUGHTER_IN_LAW", "husband is the head's son");

    const u1 = await mkUpload();
    assert.deepEqual(await saveApplication({ uploadId: u1.id, mode: "existing", familyCode: "NR-NONE", relation: "DAUGHTER_IN_LAW", applicant, application: appFields, by: { uid: "t", name: "t" } }), { ok: false, error: "familyNotFound" });
    const r1 = await saveApplication({ uploadId: u1.id, mode: "existing", familyCode: fam.code.toLowerCase(), relation: "DAUGHTER_IN_LAW", applicant, application: appFields, by: { uid: "t", name: "t" } });
    assert.ok(r1.ok && r1.familyId === fam.id);
    const m1 = await prisma.member.findUniqueOrThrow({ where: { id: r1.ok ? r1.memberId : "" }, include: { application: true } });
    assert.equal(m1.relation, "DAUGHTER_IN_LAW");
    assert.equal(m1.isHead, false);
    assert.equal(m1.application?.feeTotal, 501);
    assert.deepEqual(m1.application?.docs, ["AADHAAR"]);
    assert.equal(m1.application?.appDate?.toISOString().slice(0, 10), "2024-05-12");
    assert.ok((await evaluateAll()).rows.find((r) => r.member.id === m1.id)?.result.eligible, "approved applicant is a voter");
    assert.deepEqual(await saveApplication({ uploadId: u1.id, mode: "new", relation: "SELF", applicant, application: appFields, by: { uid: "t", name: "t" } }), { ok: false, error: "alreadySaved" });

    await prisma.membershipApplication.update({ where: { memberId: m1.id }, data: { decision: "PENDING" } });
    assert.deepEqual((await evaluateAll()).rows.find((r) => r.member.id === m1.id)?.result.reasons, ["NOT_APPROVED"]);

    const u2 = await mkUpload();
    const r2 = await saveApplication({ uploadId: u2.id, mode: "new", relation: "OTHER", applicant: { ...applicant, firstName: "राहुल", title: "श्री", gender: "MALE" }, application: appFields, by: { uid: "t", name: "t" } });
    assert.ok(r2.ok);
    if (r2.ok) created.push(r2.familyId);
    const nf = await prisma.family.findUniqueOrThrow({ where: { id: r2.ok ? r2.familyId : "" }, include: { members: true } });
    assert.equal(nf.panthStatus, "TO_VERIFY");
    assert.equal(nf.members[0].isHead, true);
    assert.equal(nf.members[0].relation, "SELF");
    assert.deepEqual((await evaluateAll()).rows.find((r) => r.member.familyId === nf.id)?.result.reasons, ["PANTH_TO_VERIFY"]);
  } finally {
    for (const id of [fam.id, ...created]) {
      await prisma.member.deleteMany({ where: { familyId: id } });
      await prisma.formUpload.deleteMany({ where: { familyId: id } });
      await prisma.family.delete({ where: { id } });
    }
    await prisma.formUpload.deleteMany({ where: { uploadedBy: "test", kind: "INDIVIDUAL" } });
  }
});

test("application of someone already on a census form is linked to that member, blanks filled only", { skip: !run }, async () => {
  const { prisma } = await import("./db");
  const { saveApplication, suggestFamilies, applicationData } = await import("./applications");
  after(() => prisma.$disconnect());
  const stamp = Date.now();
  const fam = await prisma.family.create({ data: { code: `AS-${stamp}`, headName: "सुरेश ताराचंद झांबड", address: "जेल रोड", panth: "STHANAKVASI", panthStatus: "CONFIRMED" } });
  await prisma.member.create({ data: { familyId: fam.id, firstName: "सुरेश", middleName: "ताराचंद", surname: "झांबड", isHead: true, relation: "SELF", gender: "MALE" } });
  const wife = await prisma.member.create({ data: { familyId: fam.id, firstName: "सुनीता", middleName: "सुरेश", surname: "झांबड", relation: "WIFE", gender: "FEMALE", age: 50, ageRecordedOn: new Date(), mobile: "9800000011" } });
  const up = await prisma.formUpload.create({ data: { kind: "INDIVIDUAL", imageKeys: [], status: "EXTRACTED", extracted: {}, uploadedBy: "test" } });
  const empty = applicationData({ appNo: "", appDate: "", homeAddress: "", businessAddress: "", email: "", landline: "", feeEntry: "", feeAnnual: "", feeLifetime: "", feeTotal: "", receiptNo: "", receiptDate: "", proposerName: "", proposerAddress: "", proposerMobile: "", proposerLandline: "", seconderName: "", seconderAddress: "", seconderMobile: "", seconderLandline: "", decision: "", meetingDate: "", rejectReasons: "", docs: [], notes: "" });
  const appFields = { ...Object.fromEntries(Object.keys(empty).map((k) => [k, ""])), docs: [], appNo: "7", decision: "APPROVED" } as never;
  const applicant = { title: "सौ.", firstName: "सुनिता", middleName: "सुरेश", surname: "झांबड", firstNameEn: "Sunita", middleNameEn: "Suresh", surnameEn: "Jhambad", nameRaw: "", gender: "FEMALE", dob: "", age: "52", mobile: "9800000099", occupation: "गृहिणी", education: "", bloodGroup: "B+" };
  try {
    const s = await suggestFamilies({ firstName: "सुनिता", surname: "झांबड", middleName: "सुरेश", gender: "FEMALE", mobile: "", homeAddress: "" });
    const mine = s.find((x) => x.id === fam.id);
    assert.deepEqual(mine?.sameMembers.map((m) => m.id), [wife.id], "spelling folds: सुनिता = सुनीता");
    const r = await saveApplication({ uploadId: up.id, mode: "existing", familyCode: fam.code, relation: "WIFE", memberId: wife.id, applicant, application: appFields, by: { uid: "t", name: "t" } });
    assert.ok(r.ok && r.memberId === wife.id);
    const after1 = await prisma.member.findUniqueOrThrow({ where: { id: wife.id }, include: { application: true } });
    assert.equal(await prisma.member.count({ where: { familyId: fam.id } }), 2, "no second member");
    assert.equal(after1.mobile, "9800000011", "saved mobile kept");
    assert.equal(after1.age, 50, "saved age kept");
    assert.equal(after1.bloodGroup, "B+", "blank filled");
    assert.equal(after1.firstNameEn, "Sunita", "blank English name filled");
    assert.equal(after1.application?.appNo, "7");
    const up2 = await prisma.formUpload.create({ data: { kind: "INDIVIDUAL", imageKeys: [], status: "EXTRACTED", extracted: {}, uploadedBy: "test" } });
    assert.deepEqual(await saveApplication({ uploadId: up2.id, mode: "existing", familyCode: fam.code, relation: "WIFE", memberId: wife.id, applicant, application: appFields, by: { uid: "t", name: "t" } }), { ok: false, error: "memberHasApplication" });
    await prisma.formUpload.delete({ where: { id: up2.id } });
  } finally {
    await prisma.membershipApplication.deleteMany({ where: { member: { familyId: fam.id } } });
    await prisma.member.deleteMany({ where: { familyId: fam.id } });
    await prisma.formUpload.delete({ where: { id: up.id } });
    await prisma.family.delete({ where: { id: fam.id } });
  }
});

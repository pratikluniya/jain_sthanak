// Creates the first admin user when the database has no users yet.
// Needs SEED_ADMIN_MOBILE and SEED_ADMIN_PASSWORD (8+ characters) in .env for the FIRST start only;
// remove the password from .env afterwards and change it in the app.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
try {
  const users = await prisma.user.count();
  if (users > 0) process.exit(0);
  const mobile = (process.env.SEED_ADMIN_MOBILE || "").replace(/\D/g, "").slice(-10);
  const password = process.env.SEED_ADMIN_PASSWORD || "";
  if (mobile.length !== 10 || password.length < 8) {
    console.warn("[bootstrap] no users yet: set SEED_ADMIN_MOBILE and SEED_ADMIN_PASSWORD (8+ chars) in .env and restart");
    process.exit(0);
  }
  await prisma.user.create({
    data: { name: process.env.SEED_ADMIN_NAME || "Admin", mobile, role: "ADMIN", passwordHash: await bcrypt.hash(password, 10) },
  });
  console.log(`[bootstrap] admin user created for mobile ${mobile}`);
} finally {
  await prisma.$disconnect();
}

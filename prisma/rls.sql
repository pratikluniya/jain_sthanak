-- Supabase exposes the public schema through its REST API. The app only talks to the
-- database through Prisma (postgres role, which bypasses RLS), so we enable RLS with
-- NO policies: the REST API can then read nothing. Run after every `prisma db push`.
ALTER TABLE "AuditLog"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Counter"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Family"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FormUpload" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Member"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Setting"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User"       ENABLE ROW LEVEL SECURITY;

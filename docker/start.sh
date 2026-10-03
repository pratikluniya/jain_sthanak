#!/bin/sh
# Runs every time the app container starts.
set -e
# 1. Bring the database tables in line with prisma/schema.prisma.
#    Adding tables/columns is automatic. A change that would DELETE data stops here (no --accept-data-loss),
#    so a mistake in the schema can never wipe member data silently.
prisma db push --skip-generate --schema prisma/schema.prisma
# 2. First start only: create the admin user from SEED_ADMIN_* if there are no users yet.
node docker/bootstrap-admin.mjs
# 3. Start the website.
exec node server.js

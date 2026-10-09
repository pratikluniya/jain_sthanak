# Jain Sangh Nashik Road: Member and Voter Dashboard

Web app (mobile-first, Marathi / Hindi / English) for श्री जैन स्थानकवासी श्रावक संघ, नाशिकरोड:
families, members, form photo upload with AI reading, voter list, exports, receipts.

Stack: Next.js 14 · PostgreSQL 16 · Prisma · Claude API (form reading, optional) · Docker + Caddy on a DigitalOcean Droplet (Bangalore) · GitHub Actions CI/CD.

## Features (v0.1)

| Area | What it does |
|---|---|
| Login | Mobile number + password. Roles: Admin, Operator, Data entry, Viewer |
| Languages | Marathi, Hindi, English screens; exports in any of the three. English name spelling per member (automatic, volunteer corrects) |
| Families | List, search, add / edit, panth "to verify" queue, linked households |
| Members | Search by name (spelling-tolerant: लुणिया = लुनिया, दीपिका = दिपिका), mobile, family no., blood group |
| Form upload | Phone photo (1-4 pages) > rotate > AI reads > volunteer checks (unclear fields in yellow) > save as new / add to existing / linked family. Duplicate warning by name, mobile, address |
| Voter list | 18+ as on the age cut-off date (default 01/10/2026, editable in Settings) + any panth except Digambar (confirmed). Blank panth = excluded until confirmed. Borderline 17/18 flagged. Fixed voter numbers |
| Exports | Voter list / all members, choose columns, Excel + print-ready PDF (Marathi, English digits, sorted by surname) |
| Receipts | वर्गणी receipts, auto number per financial year (2026-27/0001), amount in words, print |
| KYC | Aadhaar number stored encrypted (AES-256-GCM), only last 4 digits shown; scan viewable by Admin and Operator; approval by Admin / Operator |
| Audit | Every create / edit / delete / export / KYC view is logged |

### Role permissions

| | Admin | Operator | Data entry | Viewer |
|---|---|---|---|---|
| View and search | ✔ | ✔ | ✔ | ✔ |
| Add / edit | ✔ | ✔ | ✔ | |
| Upload forms | ✔ | ✔ | ✔ | |
| Delete | ✔ | ✔ | | |
| Confirm panth, approve KYC, voter numbers | ✔ | ✔ | | |
| Export Excel / PDF | ✔ | ✔ | | |
| Receipts | ✔ | ✔ | | |
| Aadhaar scan | ✔ | ✔ | | |
| Users, settings | ✔ | | | |

## Rules (decided 27 Sep 2026)

- Voter: age 18+ as on the age cut-off date (Settings > आयु गणना तिथि, default 01/10/2026), family panth confirmed and anything except Digambar (decided 9 Oct 2026).
- Forms have only age, no DOB. Age is stored with the form date. If someone could be 17 or 18 on the cut-off date, they are flagged "needs DOB".
- Membership cancellation rules printed on the form (moved out, deceased, married daughters) are OFF. A switch in Settings turns them on.

## Run locally

```
npm install
cp .env.example .env        # set DATABASE_URL to a local Postgres, STORAGE_DRIVER="local"
npx prisma db push          # create tables
SEED_ADMIN_MOBILE=98xxxxxxxx SEED_ADMIN_PASSWORD='StrongPass1' SEED_ADMIN_NAME='Pratik Luniya' npm run db:seed
npm run dev                 # http://localhost:3000
npm test                    # rule tests (names, digits, relations, eligibility, amount in words)
```

Bulk import of forms read outside the app (goes to the check queue, never straight into families): Admin > फॉर्म अपलोड > Import batch, or locally `npm run import:forms -- <folder with forms.json + photos>`.

`npm run db:seed -- --demo` also loads the sample forms from `demo/` (not in Git: real personal data).

## Deploy (DigitalOcean)

Full steps: `docs/SERVER-SETUP.md`. Day-to-day running: `docs/RUNBOOK.md`.

1. One-time: Droplet (2 GB, Bangalore, $12/month) + firewall + Cloudflare DNS + Google Drive backup (rclone), `scripts/server-setup.sh`, `/opt/jainsangh/.env`, GitHub secrets `SSH_HOST`, `SSH_USER`, `SSH_KEY`.
2. Every push to `main`: GitHub Actions runs the tests, builds the Docker image (pushed to ghcr.io) and restarts the app on the server.
3. On start the app container runs `prisma db push` (adds new tables/columns, refuses data loss) and creates the first admin from `SEED_ADMIN_*` if there are no users.

| File | What it is |
|---|---|
| `Dockerfile` | Builds the app image (Next.js standalone) |
| `docker-compose.yml` | Server services: `db`, `app`, `caddy`, `backup` |
| `Caddyfile` | HTTPS front door |
| `docker/backup/` | Nightly database copy on the server (14 days) |
| `scripts/drive-backup.sh` | Weekly encrypted copy to the Sangh's Google Drive |
| `.github/workflows/deploy.yml` | CI/CD |
| `scripts/server-setup.sh` | One-time server preparation |

## Code map

```
prisma/schema.prisma        data model
src/lib/normalize.ts        digits, mobile, blood group, name split, phonetic search key
src/lib/relations.ts        relation words (बायको, सून, नातू...) > fixed codes, gender
src/lib/eligibility.ts      voter rules
src/lib/extract.ts          Claude vision prompt + schema
src/lib/translit.ts         Devanagari name -> English spelling
src/lib/storage.ts          files: server disk (local) or optional S3-compatible storage
src/lib/importBatch.ts      batch import of forms read outside the app
src/lib/uploads.ts          extraction run, duplicate finder
src/lib/exportRows.ts       voter / member export columns
src/app/(app)/...           screens
src/app/print, receipt      print-ready pages (outside the app layout)
```

## Known limits

- PDF = browser "Print > Save as PDF" (keeps Devanagari correct). No server PDF file.
- AI reading takes 20-60 s per form and costs a few US cents [Unverified: measure on real forms].
- Marathi amount-in-words spellings should be checked once by the committee.

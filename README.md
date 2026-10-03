# Jain Sangh Nashik Road: Member and Voter Dashboard

Web app (mobile-first, Marathi / Hindi) for श्री जैन स्थानकवासी श्रावक संघ, नाशिकरोड:
families, members, form photo upload with AI reading, voter list, exports, receipts.

Stack: Next.js 14 · PostgreSQL (Supabase) · Prisma · Claude API (form reading) · Vercel.

## Features (v0.1)

| Area | What it does |
|---|---|
| Login | Mobile number + password. Roles: Admin, Operator, Data entry, Viewer |
| Families | List, search, add / edit, panth "to verify" queue, linked households |
| Members | Search by name (spelling-tolerant: लुणिया = लुनिया, दीपिका = दिपिका), mobile, family no., blood group |
| Form upload | Phone photo (1-4 pages) > rotate > AI reads > volunteer checks (unclear fields in yellow) > save as new / add to existing / linked family. Duplicate warning by name, mobile, address |
| Voter list | 18+ as on the age cut-off date (default 01/10/2026, editable in Settings) + Sthanakvasi (confirmed). Blank panth = excluded until confirmed. Borderline 17/18 flagged. Fixed voter numbers |
| Exports | Voter list / all members, choose columns, Excel + print-ready PDF (Marathi, English digits, sorted by surname) |
| Receipts | वर्गणी receipts, auto number per financial year (2026-27/0001), amount in words, print |
| KYC | Aadhaar number stored encrypted (AES-256-GCM), only last 4 digits shown; scan viewable by Admin only; approval by Admin / Operator |
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
| Full Aadhaar / scan | ✔ | ✔ | | |
| Users, settings | ✔ | | | |

## Rules (decided 27 Sep 2026)

- Voter: age 18+ as on the age cut-off date (Settings > आयु गणना तिथि, default 01/10/2026), family panth Sthanakvasi and confirmed.
- Forms have only age, no DOB. Age is stored with the form date. If someone could be 17 or 18 on the cut-off date, they are flagged "needs DOB".
- Membership cancellation rules printed on the form (moved out, deceased, married daughters) are OFF. A switch in Settings turns them on.

## Run locally

```
npm install
cp .env.example .env        # fill in values (see docs/SETUP.md)
npx prisma db push          # create tables
SEED_ADMIN_MOBILE=98xxxxxxxx SEED_ADMIN_PASSWORD='StrongPass1' SEED_ADMIN_NAME='Pratik Luniya' npm run db:seed
npm run dev                 # http://localhost:3000
npm test                    # rule tests (names, digits, relations, eligibility, amount in words)
```

Bulk import of forms read outside the app (goes to the check queue, never straight into families): `npm run import:forms -- <folder with forms.json + photos>`.

`npm run db:seed -- --demo` also loads the sample forms from `demo/` (not in Git: real personal data).

## Deploy (Vercel + Supabase)

1. Complete `docs/SETUP.md` (Supabase project, buckets `forms` and `kyc`, Anthropic key).
2. From your Mac, with `.env` pointing at Supabase: `npx prisma db push`, then `npm run db:secure` (turns on Row Level Security so Supabase's public API cannot read the tables), then run the seed command above once.
3. Push to GitHub. In Vercel import the repo, add every variable from `.env` (not `STORAGE_DRIVER`), deploy.
4. Log in as admin > Users: create Operator / Data entry / Viewer accounts. Settings: set Sangh address and receipt purposes.

## Code map

```
prisma/schema.prisma        data model
src/lib/normalize.ts        digits, mobile, blood group, name split, phonetic search key
src/lib/relations.ts        relation words (बायको, सून, नातू...) > fixed codes, gender
src/lib/eligibility.ts      voter rules
src/lib/extract.ts          Claude vision prompt + schema
src/lib/uploads.ts          extraction run, duplicate finder
src/lib/exportRows.ts       voter / member export columns
src/app/(app)/...           screens
src/app/print, receipt      print-ready pages (outside the app layout)
```

## Known limits

- PDF = browser "Print > Save as PDF" (keeps Devanagari correct). No server PDF file.
- AI reading takes 20-60 s per form and costs a few US cents [Unverified: measure on real forms].
- Marathi amount-in-words spellings should be checked once by the committee.

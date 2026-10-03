# Runbook: Jain Sangh Dashboard

How to run, update and look after the app. Keep this file up to date when something changes.

> Items marked [Unverified] are based on the service's documentation as I understood it on 29 Sep 2026 and should be checked on the provider's site.

---

## 1. What runs where

| Part | Service | Account owner | Notes |
|---|---|---|---|
| Code | GitHub `pratikluniya/jain_sthanak` (private) | TechShree / Pratik | `main` branch = live app |
| Website | Vercel (`*.vercel.app`) | TechShree / Pratik | Deploys automatically on every push to `main` |
| Database | Supabase Postgres, Mumbai | TechShree / Pratik | Row Level Security ON for all tables |
| Files (form photos, Aadhaar scans) | Supabase Storage buckets `forms`, `kyc` (private) | same | Never make these buckets public |
| Secrets | `.env` on Pratik's Mac + Vercel Environment Variables | Pratik | Copy of `.env` kept in password manager |

---

## 2. Day-to-day use (no coding)

| Task | Role needed | Screen |
|---|---|---|
| Upload and check forms | Data entry, Operator, Admin | फॉर्म अपलोड |
| Edit family / member | Data entry, Operator, Admin | कुटुंबे > family > बदला |
| Confirm blank panth | Operator, Admin | कुटुंबे > तपासणी बाकी |
| Approve KYC | Operator, Admin | Family page > KYC मंजूर करा |
| Voter list, voter numbers, exports | Operator, Admin | मतदार यादी / निर्यात |
| Receipts | Operator, Admin | पावत्या |
| Users (add, disable, reset password) | Admin | वापरकर्ते |
| Age cut-off date (18+), election date, Sangh name/address, receipt purposes | Admin | सेटिंग्ज |

Every create / edit / delete / export / Aadhaar view is recorded in the `AuditLog` table.

### Forgotten password
Admin opens वापरकर्ते, types a new password (min 8 characters) on that user's row, clicks जतन करा.

### Admin locked out
From the Mac, in the project folder:
```
SEED_ADMIN_MOBILE=7755998862 SEED_ADMIN_PASSWORD='NewStrongPass1' SEED_ADMIN_NAME='Pratik Luniya' npm run db:seed
```
This resets the admin password. It does not touch any other data.

---

## 3. Changing the app (code)

### Normal change
1. Make the change (or ask Claude in a Cowork session to make it in `JainStanak/jainsangh`).
2. Test locally if possible: `npm run dev`, open http://localhost:3000.
3. Run checks: `npm test` and `npm run typecheck`.
4. Publish:
   ```
   cd ~/Downloads/Clients/JainStanak/jainsangh
   git add . && git commit -m "short description of change" && git push
   ```
5. Vercel builds and goes live in about 2 minutes. Check the Vercel dashboard > Deployments for a green "Ready".

### Safer change (recommended for big features)
```
git checkout -b feature-name
git add . && git commit -m "..." && git push -u origin feature-name
```
Vercel gives this branch its own preview link. Test there. When happy, merge into `main` on GitHub (Pull request > Merge). Note: preview links use the same live database, so do not test deletes on real data.

### Change that adds or alters database fields
After editing `prisma/schema.prisma`:
```
npx prisma db push      # updates the live database structure
npm run db:secure       # re-applies Row Level Security (always run after db push)
```
Then push the code as usual. `db push` warns before any change that would delete data: read the warning, do not accept data loss.

### Roll back a bad deploy
Vercel > Project > Deployments > pick the last working deployment > "..." > **Promote to Production**. Takes seconds. Data is not affected. Then fix the code and push again.

---

## 4. Importing forms read outside the app

Forms read by Claude in a Cowork session are delivered as a folder containing `forms.json` and the photos. Import them into the check queue (they are never saved to families without a volunteer checking them):
```
npm run import:forms -- ../import/batch-01
```
Re-running the same batch is safe: already imported photos are skipped.

---

## 5. Backups

[Unverified] The Supabase free plan may not include backups you can download. Until confirmed:
- **Weekly:** निर्यात > सर्व सदस्य यादी > tick all columns > Excel. Save the file with the date in its name, in a safe place (not only on the Mac).
- **Before any database change (section 3):** take the same export.
- **Before the election:** consider the Supabase paid plan for automatic daily backups, and check that the project is not at risk of pausing.

---

## 6. Secrets: rules

| Secret | If lost | If leaked |
|---|---|---|
| `AADHAAR_ENC_KEY` | Stored Aadhaar numbers can never be read again. **Never change it.** | Rotate is not possible without re-entering Aadhaar numbers: treat as serious, inform the committee |
| `AUTH_SECRET` | Generate a new one; everyone just logs in again | Change it in Vercel and `.env`, redeploy: all sessions end |
| `SUPABASE_SERVICE_ROLE_KEY` | Get it again from Supabase > Project Settings > API | Supabase > API > roll the key, update Vercel and `.env`, redeploy |
| Database password | Reset in Supabase > Project Settings > Database | Reset it, update `DATABASE_URL` and `DIRECT_URL` in Vercel and `.env`, redeploy |
| GitHub token | Create a new fine-grained token (Contents: Read and write, only this repo) | Delete it on GitHub > Settings > Developer settings |

After changing any variable in Vercel: Deployments > latest > "..." > **Redeploy**, otherwise the old value stays in use.

Never paste secrets into chat, WhatsApp or email. Never commit `.env` (it is in `.gitignore`).

---

## 7. Regular maintenance

| When | What |
|---|---|
| Weekly | Excel backup (section 5). Glance at फॉर्म अपलोड for forms stuck in the queue |
| Monthly | Review users: disable volunteers who no longer help |
| Every 3 months | Security updates: `npm outdated`, update Next.js within the 14.2.x line (`npm install next@14 eslint-config-next@14`), run tests, push. Check GitHub > Security tab for alerts |
| Every 3 months | GitHub token expires (90 days): create a new one when push asks for a password |
| Yearly (April) | Receipt numbers restart automatically for the new financial year (e.g. 2027-28/0001). Update receipt purposes in सेटिंग्ज if needed |
| Before election | Check the age cut-off date and set the election date in सेटिंग्ज, clear the "पंथ तपासणी बाकी" and "जन्मतारीख हवी" lists, assign voter numbers, export and print the final list |

---

## 8. Known limits and watch points

- [Unverified] Supabase free projects pause after about a week without activity. Opening the app regularly prevents it; a paused project can be resumed from the Supabase dashboard.
- [Unverified] Vercel's free Hobby plan is for non-commercial use. Check whether TechShree hosting for the Sangh needs the Pro plan.
- In-app AI form reading is OFF (no `ANTHROPIC_API_KEY`). Adding the key in Vercel + redeploy switches it on; set a monthly spend limit in the Anthropic console first.
- PDF export uses the browser's Print > Save as PDF (keeps Marathi text correct).
- Marathi amount-in-words spellings on receipts should be checked once by the committee.

---

## 9. Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| Vercel build fails | Code error or missing env variable | Open the failed deployment log; compare Environment Variables with `.env.example` |
| App shows an error on every page | Database unreachable or paused | Supabase dashboard: is the project paused? Resume it. Check database password in Vercel |
| Photos do not load | Storage key or bucket issue | Check `SUPABASE_URL` is exactly `https://<ref>.supabase.co` (no `/rest/v1/`) and buckets `forms`, `kyc` exist |
| `git push` asks for password / 403 | GitHub token expired or wrong permission | New fine-grained token with Contents: Read and write; clear old one: `printf "protocol=https\nhost=github.com\n\n" \| git credential-osxkeychain erase` |
| Login fails for everyone | `AUTH_SECRET` missing or shorter than 32 characters | Fix in Vercel, redeploy |
| Person missing from voter list | Panth to verify, age borderline, or panth not Sthanakvasi | मतदार यादी > तपासणी बाकी tab shows the reason |

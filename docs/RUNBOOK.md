# Runbook: Jain Sangh Dashboard

How to run, update and look after the app. Keep this file up to date when something changes.

> Updated 3 Oct 2026 for the AWS Lightsail setup. Items marked [Unverified] should be checked on the provider's site.

---

## 1. What runs where

| Part | Where | Notes |
|---|---|---|
| Code | GitHub `pratikluniya/jain_sthanak` (private) | `main` branch = live app |
| Server | AWS Lightsail `jainsangh-prod`, Mumbai, 2 GB, Ubuntu 24.04 | Account owned and billed by TechShree for the Sangh |
| Website | Docker container `app` on the server, behind Caddy (HTTPS) | Address: the techshree.com subdomain in `.env` (`APP_DOMAIN`) |
| Database | Docker container `db` (PostgreSQL 16) on the server | Not reachable from the internet. Data in the Docker volume `pgdata` |
| Files (form photos, Aadhaar scans) | Lightsail bucket, prefixes `forms/` and `kyc/` | Private. Never make it public |
| Backups | Nightly `pg_dump` to the bucket `backups/` (30 days) + Lightsail daily snapshots (7 days) | See section 5 |
| Deploys | GitHub Actions `test-build-deploy` | Every push to `main`: test > build image > deploy |
| Secrets | `/opt/jainsangh/.env` on the server + a copy in the password manager | Never in git |

Full setup steps: `docs/AWS-SETUP.md`.

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
Putting `SEED_ADMIN_PASSWORD` back in `.env` does not help: it only works when there are no users at all. Reset the password on the server instead:
```
cd /opt/jainsangh
docker compose exec app node -e "const b=require('bcryptjs');const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();b.hash(process.argv[1],10).then(h=>p.user.update({where:{mobile:'7755998862'},data:{passwordHash:h,active:true}})).then(()=>console.log('ok')).finally(()=>p.\$disconnect())" 'NewStrongPass1'
```
It changes only that user's password.

---

## 3. Changing the app (code)

### Normal change
1. Make the change (or ask Claude in a Cowork session to make it in `JainStanak/jainsangh`).
2. Test locally if possible: `npm run dev`, open http://localhost:3000.
3. Run checks: `npm test` and `npm run typecheck`.
4. Publish:
   ```
   cd ~/Downloads/Clients/JainStanak/jainsangh
   git add -A && git commit -m "short description of change" && git push origin main
   ```
5. GitHub > **Actions** shows the run. About 5 to 8 minutes later the new version is live. If the tests fail, nothing is deployed and the server keeps the old version.

### Bigger change
Work on a branch (`git switch -c feature-name`, push it), open a Pull request on GitHub, merge into `main` when ready. Only `main` deploys.

### Change that adds or alters database fields
Edit `prisma/schema.prisma` and push as usual. When the app container starts, it runs `prisma db push`: new tables and columns are added automatically. A change that would delete data is refused and the container stops with an error in the logs (section 9); nothing is lost. Such a change needs a planned step: take a backup first (section 5), then ask Claude for a migration.

### Roll back a bad deploy
Each deploy is a Docker image tagged with its git commit. On the server:
```
cd /opt/jainsangh
cat deploys.log                       # list of deployed images, newest last
APP_IMAGE=ghcr.io/pratikluniya/jain_sthanak:<older commit> docker compose up -d app
```
To pull an older image, log in to GitHub's registry once with a token that has `read:packages`:
`echo <token> | docker login ghcr.io -u pratikluniya --password-stdin`. Then fix the code and push again.

### Look at the server
```
ssh -i ~/.ssh/<key> ubuntu@<static IP>
cd /opt/jainsangh
docker compose ps                     # what is running
docker compose logs --tail 100 app    # app messages and errors
docker compose logs --tail 50 caddy   # HTTPS / certificate messages
docker compose restart app            # restart the website
free -h ; df -h /                     # memory and disk
```

---

## 4. Importing forms read outside the app

Forms read by Claude in a Cowork session are delivered as a folder with `forms.json` and the photos (F1.jpg = form, F1_1.jpg = KYC document).
Admin: **फॉर्म अपलोड** > **Import batch** > batch name (e.g. `forms-batch-02`) > choose `forms.json` > choose all photos > **Import**.
Each form goes to the check queue; nothing is saved to families until a volunteer checks it. Importing the same batch again skips forms already imported. Aadhaar numbers are encrypted on the server before saving; delete the local `forms.json` afterwards because it holds plain numbers.

---

## 5. Backups

| What | When | Kept | Where |
|---|---|---|---|
| Database dump (`pg_dump`, gzip) | Every night 03:00 IST | 30 days | Bucket `backups/` |
| Whole server snapshot | Daily (Lightsail automatic) | 7 days | Lightsail > Snapshots |
| Photos and scans | Stored once in the bucket | Until deleted | Bucket `forms/`, `kyc/` |

Backup by hand (before any risky change): `docker compose exec backup backup.sh`

Restore the database from a dump (replaces ALL current data; take a fresh dump first):
```
cd /opt/jainsangh
docker compose exec backup sh -c '. /etc/backup.env; aws s3 cp s3://$S3_BUCKET/backups/<file>.sql.gz - | gunzip | psql'
docker compose restart app
```
Restore the whole server: Lightsail > Snapshots > **Create new instance** from a snapshot, move the static IP to it.

The `AADHAAR_ENC_KEY` is not in any backup. Keep the `.env` copy in the password manager.

---

## 6. Secrets: rules

| Secret | If lost | If leaked |
|---|---|---|
| `AADHAAR_ENC_KEY` | Stored Aadhaar numbers can never be read again. **Never change it.** | Rotate is not possible without re-entering Aadhaar numbers: treat as serious, inform the committee |
| `AUTH_SECRET` | Generate a new one; everyone just logs in again | Change it in `.env`, `docker compose up -d app`: all sessions end |
| Bucket access key (`S3_*`) | Create a new key in Lightsail > bucket > Permissions | Delete the old key in Lightsail, create a new one, update `.env`, `docker compose up -d` |
| `POSTGRES_PASSWORD` | It is in `.env` and the password manager | Ask Claude for the steps: the password is also stored inside the database volume |
| Deploy SSH key (`SSH_KEY` secret) | Make a new key pair (AWS-SETUP step 8) | Remove its line from `~/.ssh/authorized_keys` on the server, make a new one |
| GitHub token (Mac) | Create a new fine-grained token (Contents: Read and write, only this repo) | Delete it on GitHub > Settings > Developer settings |

After changing `.env`, run `docker compose up -d` in `/opt/jainsangh` so the containers pick up the new values.

Never paste secrets into chat, WhatsApp or email. Never commit `.env` (it is in `.gitignore`).

---

## 7. Regular maintenance

| When | What |
|---|---|
| Weekly | Glance at फॉर्म अपलोड for forms stuck in the queue. Check the bucket has last night's backup |
| Monthly | Check the AWS bill (Billing > Bills). Expected about $15 + GST [Unverified: GST on AWS invoices] |
| Monthly | Review users: disable volunteers who no longer help |
| Every 3 months | Security updates: `npm outdated`, update Next.js within the 14.2.x line (`npm install next@14 eslint-config-next@14`), run tests, push. Check GitHub > Security tab for alerts. Ubuntu security updates install themselves; reboot the server once (`sudo reboot`) if `/var/run/reboot-required` exists |
| Every 3 months | Test a restore: download one backup and check it opens |
| Every 3 months | GitHub token expires (90 days): create a new one when push asks for a password |
| Yearly (April) | Receipt numbers restart automatically for the new financial year (e.g. 2027-28/0001). Update receipt purposes in सेटिंग्ज if needed |
| Before election | Check the age cut-off date and set the election date in सेटिंग्ज, clear the "पंथ तपासणी बाकी" and "जन्मतारीख हवी" lists, assign voter numbers, export and print the final list |

---

## 8. Known limits and watch points

- One server: if it fails, the app is down until it is rebuilt from a snapshot (about 30 minutes). Acceptable for this use.
- 2 GB memory: enough for the Sangh's ~350 families. If `free -h` shows swap used heavily, move to the 4 GB plan (Lightsail > Snapshots > new instance from snapshot with a bigger plan).
- In-app AI form reading is OFF until `ANTHROPIC_API_KEY` is set in `.env`. Set a monthly spend limit in the Anthropic console first, then `docker compose up -d app`.
- PDF export uses the browser's Print > Save as PDF (keeps Marathi text correct).
- English name spellings are made automatically and should be checked by volunteers.
- Marathi amount-in-words spellings on receipts should be checked once by the committee.

---

## 9. Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| GitHub Action "test" fails | Code error | Open the run, read the red step, fix and push |
| GitHub Action "deploy" fails at SSH | `SSH_HOST` / `SSH_KEY` secret wrong, or server off | Check the secrets; check the instance is running in Lightsail |
| Site does not open, HTTPS error | DNS not pointing at the static IP, or port 443 closed | `dig +short <domain>`; Lightsail firewall must allow 443; `docker compose logs caddy` |
| App shows an error on every page | Database or app container stopped | `docker compose ps`; `docker compose logs app`; `docker compose up -d` |
| App container keeps restarting | `prisma db push` refused a change that would delete data, or a wrong `.env` value | `docker compose logs app`, read the first error |
| Photos do not load | Bucket name or access key wrong | Check `S3_*` in `.env`; the key must belong to that bucket |
| `git push` asks for password / 403 | GitHub token expired | New fine-grained token with Contents: Read and write |
| Login fails for everyone | `AUTH_SECRET` missing or shorter than 32 characters | Fix in `.env`, `docker compose up -d app` |
| Person missing from voter list | Panth to verify, age borderline, or panth not Sthanakvasi | मतदार यादी > तपासणी बाकी tab shows the reason |

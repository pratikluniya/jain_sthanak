# Runbook: Jain Sangh Dashboard

How to run, update and look after the app. Keep this file up to date when something changes.

> Updated 4 Oct 2026 for the DigitalOcean setup. Items marked [Unverified] should be checked on the provider's site.

---

## 1. What runs where

| Part | Where | Notes |
|---|---|---|
| Code | GitHub `pratikluniya/jain_sthanak` (private) | `main` branch = live app |
| Server | DigitalOcean Droplet `jainsangh-prod`, Bangalore (BLR1), 2 GB, Ubuntu 24.04 | Account nashikroadjainsthanak@gmail.com, billed to TechShree |
| Website | Docker container `app` on the server, behind Caddy (HTTPS) | Address: the techshree.com subdomain in `.env` (`APP_DOMAIN`) |
| Database | Docker container `db` (PostgreSQL 16) on the server | Not reachable from the internet. Data in the Docker volume `pgdata` |
| Files (form photos, Aadhaar scans) | Server disk `/opt/jainsangh/data/uploads` (`forms/`, `kyc/`) | Only reachable through the logged-in app |
| Backups | Nightly database copy on the server (14 days) + weekly encrypted copy of everything to the Sangh's Google Drive | See section 5 |
| Deploys | GitHub Actions `test-build-deploy` | Every push to `main`: test > build image > deploy |
| Secrets | `/opt/jainsangh/.env` on the server + a copy in the password manager | Never in git |

Full setup steps: `docs/SERVER-SETUP.md`.

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
ssh -i ~/.ssh/jainsangh_admin root@<Droplet IP>
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

| What | When | Kept | Where | Protects against |
|---|---|---|---|---|
| Database copy (`pg_dump`, gzip) | Every night 03:00 IST | 14 days | Server: `/opt/jainsangh/data/backups` | Mistakes: bad import, deleted family |
| Database copies + photos + scans, **encrypted** | Every Sunday 04:00 IST | Copies: same 14 days. Photos/scans: never deleted on Drive | Google Drive of nashikroadjainsthanak@gmail.com, folder `jainsangh-backup` | Losing the whole server |

No paid DigitalOcean backups (decided 4 Oct 2026, to keep the bill at $12).

Backup by hand (before any risky change): `docker compose exec backup backup.sh`
Drive copy by hand: `bash /opt/jainsangh/scripts/drive-backup.sh`

Restore the database from a server copy (replaces ALL current data; take a fresh copy first):
```
cd /opt/jainsangh
gunzip -c data/backups/<file>.sql.gz | docker compose exec -T db psql -U jainsangh -d jainsangh
docker compose restart app
```
Restore after losing the server: new Droplet (SERVER-SETUP steps 3-7), put back `/root/.config/rclone/rclone.conf`
and `.env` from the password manager, then SERVER-SETUP section 11e.

The `AADHAAR_ENC_KEY` and the rclone passwords are not in any backup. Keep them in the password manager.

---

## 6. Secrets: rules

| Secret | If lost | If leaked |
|---|---|---|
| `AADHAAR_ENC_KEY` | Stored Aadhaar numbers can never be read again. **Never change it.** | Rotate is not possible without re-entering Aadhaar numbers: treat as serious, inform the committee |
| `AUTH_SECRET` | Generate a new one; everyone just logs in again | Change it in `.env`, `docker compose up -d app`: all sessions end |
| rclone crypt passwords (Drive backup) | Drive copies can never be decrypted: keep them in the password manager | Re-run `rclone config` with new passwords; old Drive copies stay readable only with the old ones |
| `POSTGRES_PASSWORD` | It is in `.env` and the password manager | Ask Claude for the steps: the password is also stored inside the database volume |
| Deploy SSH key (`SSH_KEY` secret) | Make a new key pair (SERVER-SETUP step 9) | Remove its line from `~/.ssh/authorized_keys` on the server, make a new one |
| GitHub token (Mac) | Create a new fine-grained token (Contents: Read and write, only this repo) | Delete it on GitHub > Settings > Developer settings |

After changing `.env`, run `docker compose up -d` in `/opt/jainsangh` so the containers pick up the new values.

Never paste secrets into chat, WhatsApp or email. Never commit `.env` (it is in `.gitignore`).

---

## 7. Regular maintenance

| When | What |
|---|---|
| Weekly | Glance at फॉर्म अपलोड for forms stuck in the queue. Monday: check `tail /var/log/jainsangh-drive-backup.log` ends with `done` |
| Monthly | Check the DigitalOcean bill (Billing). Expected $12 + tax [Unverified: GST on DigitalOcean invoices] |
| Monthly | Review users: disable volunteers who no longer help |
| Every 3 months | Security updates: `npm outdated`, update Next.js within the 14.2.x line (`npm install next@14 eslint-config-next@14`), run tests, push. Check GitHub > Security tab for alerts. Ubuntu security updates install themselves; reboot the server once (`sudo reboot`) if `/var/run/reboot-required` exists |
| Every 3 months | Test a restore: download one backup and check it opens |
| Every 3 months | GitHub token expires (90 days): create a new one when push asks for a password |
| Yearly (April) | Receipt numbers restart automatically for the new financial year (e.g. 2027-28/0001). Update receipt purposes in सेटिंग्ज if needed |
| Before election | Check the age cut-off date and set the election date in सेटिंग्ज, clear the "पंथ तपासणी बाकी" and "जन्मतारीख हवी" lists, assign voter numbers, export and print the final list |

---

## 8. Known limits and watch points

- One server: if it fails, the app is down until it is rebuilt from a snapshot (about 30 minutes). Acceptable for this use.
- 2 GB memory: enough for the Sangh's ~350 families. If `free -h` shows swap used heavily, move to the 4 GB plan (Droplet > **Resize** > 4 GB, a few minutes of downtime).
- In-app AI form reading is OFF until `ANTHROPIC_API_KEY` is set in `.env`. Set a monthly spend limit in the Anthropic console first, then `docker compose up -d app`.
- PDF export uses the browser's Print > Save as PDF (keeps Marathi text correct).
- English name spellings are made automatically and should be checked by volunteers.
- Marathi amount-in-words spellings on receipts should be checked once by the committee.

---

## 9. Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| GitHub Action "test" fails | Code error | Open the run, read the red step, fix and push |
| GitHub Action "deploy" fails at SSH | `SSH_HOST` / `SSH_KEY` secret wrong, or server off | Check the secrets; check the Droplet is on in DigitalOcean |
| Site does not open, HTTPS error | DNS not pointing at the Droplet IP, or port 443 closed | `dig +short <domain>`; DigitalOcean firewall `jainsangh-web` must allow 443; `docker compose logs caddy` |
| App shows an error on every page | Database or app container stopped | `docker compose ps`; `docker compose logs app`; `docker compose up -d` |
| App container keeps restarting | `prisma db push` refused a change that would delete data, or a wrong `.env` value | `docker compose logs app`, read the first error |
| Photos do not load / upload fails | Folder `data/uploads` not writable by the app (user id 1001) | `chown -R 1001:1001 /opt/jainsangh/data/uploads` |
| `git push` asks for password / 403 | GitHub token expired | New fine-grained token with Contents: Read and write |
| Login fails for everyone | `AUTH_SECRET` missing or shorter than 32 characters | Fix in `.env`, `docker compose up -d app` |
| Person missing from voter list | Panth to verify, age borderline, or panth not Sthanakvasi | मतदार यादी > तपासणी बाकी tab shows the reason |

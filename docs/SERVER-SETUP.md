# Server Setup: Jain Sangh App on DigitalOcean

One-time setup of the production server. Total time: about 1 hour.
Decided 4 Oct 2026: DigitalOcean, Bangalore (BLR1), account with nashikroadjainsthanak@gmail.com, managed and paid by TechShree.
Files (form photos, KYC scans) are stored on the server disk. No paid backups: a free nightly database copy on the server
plus a free weekly ENCRYPTED copy of everything to the Sangh's Google Drive.
(AWS Lightsail was tried on 3-4 Oct 2026 and dropped: the new AWS account could not create the 2 GB plan.)

> [Unverified] Menu names are from my knowledge of the DigitalOcean control panel and may have moved.
> Prices checked on digitalocean.com/pricing on 3 Oct 2026: Basic Droplet 2 GB / 1 vCPU / 50 GB SSD / 2 TB transfer = $12/month;
> paid backups and Spaces are NOT used.

```
Phone / laptop ──HTTPS──> Droplet (Bangalore, 2 GB)
                            ├─ Caddy      front door, free HTTPS certificate
                            ├─ app        Next.js website (Docker image from GitHub)
                            ├─ db         PostgreSQL (not reachable from the internet)
                            └─ backup     nightly database copy ──> server disk (last 14 days)
                          server disk: /opt/jainsangh/data/uploads (photos, scans), data/backups
Every Sunday 04:00 IST: data/ ──encrypted──> Google Drive of nashikroadjainsthanak@gmail.com
GitHub push to main ──> GitHub Actions: test ──> build image ──> deploy over SSH
```

Expected bill: **$12/month** (Droplet only) + tax [Unverified: GST on DigitalOcean invoices]. Google Drive: free (15 GB shared with the Gmail account).

---

## 1. Account (once)
1. https://cloud.digitalocean.com/registrations/new: sign up with **nashikroadjainsthanak@gmail.com** (email + password, not "Sign in with Google", so the login does not depend on the Gmail session).
2. Verify the email, add the TechShree card (or PayPal).
3. Turn on two-factor authentication: account menu > **My Account** > **Security** > **Two-factor authentication** (authenticator app).
4. Billing alert: **Billing** > **Billing alerts** > set **USD 25**.

## 2. SSH key (on the Mac, once)
The Droplet is reached with a key file instead of a password.
```
ssh-keygen -t ed25519 -f ~/.ssh/jainsangh_admin -C "pratik-admin"
cat ~/.ssh/jainsangh_admin.pub
```
Copy the printed line. In DigitalOcean: **Settings** > **Security** > **SSH Keys** > **Add SSH Key**, paste, name `pratik-mac`.

## 3. Droplet (the server)
**Create** > **Droplets**:
- Region: **Bangalore (BLR1)**
- Image: **Ubuntu 24.04 (LTS) x64**
- Size: **Basic** > **Regular** > **$12/mo** (2 GB / 1 CPU / 50 GB SSD / 2 TB)
- Authentication: **SSH Key** > tick `pratik-mac` (no password login)
- **Backups**: leave OFF (we use the free Google Drive copy instead)
- **Monitoring**: tick (free graphs and alerts)
- Hostname: `jainsangh-prod`
Create, wait until it shows an IP address. Write the IP down.

## 4. Firewall
**Networking** > **Firewalls** > **Create Firewall**, name `jainsangh-web`:
- Inbound: **SSH 22**, **HTTP 80**, **HTTPS 443** (all sources). Remove anything else.
- Apply to Droplet `jainsangh-prod`.

## 5. Web address (Cloudflare DNS)
techshree.com's DNS is at Cloudflare. **dash.cloudflare.com** > techshree.com > **DNS** > **Records** > **Add record**:

| Type | Name | IPv4 address | Proxy status | TTL |
|---|---|---|---|---|
| A | `jainsthanak` | the Droplet IP | **DNS only** (grey cloud) | Auto |

Check from the Mac: `dig +short jainsthanak.techshree.com` prints the IP.

## 6. Prepare the server (one script)
From the Mac:
```
ssh -i ~/.ssh/jainsangh_admin root@<Droplet IP>
```
On the server, paste the content of `scripts/server-setup.sh` into a file and run it:
```
nano server-setup.sh      # paste, Ctrl+O, Enter, Ctrl+X
bash server-setup.sh
```
It installs Docker, a 2 GB swap file, the firewall, automatic security updates and log limits, creates the user **deploy** (used by GitHub Actions) and the folder `/opt/jainsangh`.

## 7. Secrets file `/opt/jainsangh/.env`
On the server:
```
echo "POSTGRES_PASSWORD=\"$(openssl rand -hex 24)\""
echo "AUTH_SECRET=\"$(openssl rand -base64 36)\""
echo "AADHAAR_ENC_KEY=\"$(openssl rand -hex 32)\""
nano /opt/jainsangh/.env
```
Fill it like `.env.example`: the three values above, `APP_DOMAIN="jainsthanak.techshree.com"`, and for the first start only `SEED_ADMIN_MOBILE="7755998862"`, `SEED_ADMIN_PASSWORD="..."`, `SEED_ADMIN_NAME="Pratik Luniya"`.
Then:
```
chown deploy:deploy /opt/jainsangh/.env && chmod 600 /opt/jainsangh/.env
```
**Copy the whole `.env` into the password manager.** If `AADHAAR_ENC_KEY` is lost, stored Aadhaar numbers can never be read again; it is not in any backup on purpose.

## 8. Deploy key for GitHub Actions
On the Mac:
```
ssh-keygen -t ed25519 -f ~/.ssh/jainsangh_deploy -C "github-actions-deploy" -N ""
cat ~/.ssh/jainsangh_deploy.pub
```
On the server (as root): `nano /home/deploy/.ssh/authorized_keys`, paste the line at the end, save.
GitHub repo > **Settings** > **Secrets and variables** > **Actions** > **New repository secret**:

| Name | Value |
|---|---|
| `SSH_HOST` | the Droplet IP |
| `SSH_USER` | `deploy` |
| `SSH_KEY` | whole content of `~/.ssh/jainsangh_deploy` (the file without .pub) |

## 9. First deploy (after the 5 Oct meeting)
1. Vercel > Project > Settings > Git > **Disconnect** (so Vercel stops building).
2. GitHub > Pull requests > New > base `main`, compare `aws` > **Merge**.
3. GitHub > **Actions** > `test-build-deploy`: test, build, deploy turn green.
4. Open https://jainsthanak.techshree.com, log in with the admin mobile and `SEED_ADMIN_PASSWORD`, then delete the `SEED_ADMIN_PASSWORD` line from `.env` and change the password in the app.

## 10. Check the backups work
```
ssh -i ~/.ssh/jainsangh_admin root@<Droplet IP>
cd /opt/jainsangh && docker compose exec backup backup.sh
```
It prints `[backup] saved jainsangh_<date>.sql.gz`; the file is in `/opt/jainsangh/data/backups`. From then on it runs nightly at 03:00 IST and keeps 14 days.

## 11. Google Drive backup (weekly, encrypted, free)
What it does: every Sunday 04:00 IST the server takes a fresh database copy and sends `data/backups` and `data/uploads`
to the Google Drive of **nashikroadjainsthanak@gmail.com**, encrypted first with rclone "crypt". Google only sees scrambled
file names and contents. Script: `scripts/drive-backup.sh`; schedule: `/etc/cron.d/jainsangh-drive-backup` (set by server-setup.sh).

[Unverified] rclone's questions below may be worded or numbered differently in the installed version; pick the matching option.

**a. Install rclone on the Mac too** (needed once, only to log in to Google from a browser):
```
brew install rclone
```
**b. On the server (as root): connect Google Drive**
```
rclone config
```
- `n` (new remote), name: `jsdrive`
- Storage: `drive` (Google Drive)
- client_id and client_secret: press Enter (empty)
- scope: **drive.file** (rclone can only see the files it created, nothing else in the Drive)
- service_account_file: Enter. Advanced config: `n`
- Use web browser to authenticate automatically: **`n`** (the server has no browser). rclone prints a line like
  `rclone authorize "drive" "eyJ..."`. Run that exact line **in the Mac Terminal**; a browser opens: log in with
  **nashikroadjainsthanak@gmail.com** and allow. The Mac Terminal prints a token: copy it and paste it into the server prompt.
- Shared Drive: `n`. Keep this remote: `y`.

**c. On the server: add encryption on top**
Still in `rclone config`:
- `n`, name: `jsdrive-crypt`, storage: `crypt`
- remote: `jsdrive:jainsangh-backup`
- filename_encryption: `standard`; directory_name_encryption: `true`
- password: `g` (generate), 1024 bits, accept. **Copy it into the password manager now.**
- password2 (salt): `g` again, accept. **Copy it too.**
- Advanced: `n`. Keep: `y`. Quit: `q`.

**Without these two passwords the Drive copy can never be decrypted.** Store them next to the `.env` copy.
Also keep a copy of `/root/.config/rclone/rclone.conf` in the password manager (it holds both).

**d. Test it now**
```
bash /opt/jainsangh/scripts/drive-backup.sh
tail -5 /var/log/jainsangh-drive-backup.log
rclone ls jsdrive-crypt:          # readable names (decrypted view)
```
In Google Drive (web) you will see a folder `jainsangh-backup` with scrambled names. That is correct.

**e. Restore from Drive** (if the server is lost): on a new server with the same `rclone.conf`:
```
rclone copy jsdrive-crypt:uploads /opt/jainsangh/data/uploads
rclone copy jsdrive-crypt:backups/<newest file> /tmp/
```
then load the database copy as in RUNBOOK section 5.

## 12. After go-live
After a week without problems: delete the Vercel project and the Supabase project (it holds demo forms and KYC scans).

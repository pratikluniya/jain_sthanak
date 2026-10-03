# Server Setup: Jain Sangh App on DigitalOcean

One-time setup of the production server. Total time: about 1 hour.
Decided 4 Oct 2026: DigitalOcean, Bangalore (BLR1), account with nashikroadjainsthanak@gmail.com, managed and paid by TechShree.
(AWS Lightsail was tried on 3-4 Oct 2026 and dropped: the new AWS account could not create the 2 GB plan.)

> [Unverified] Menu names are from my knowledge of the DigitalOcean control panel and may have moved.
> Prices checked on digitalocean.com/pricing on 3 Oct 2026: Basic Droplet 2 GB / 1 vCPU / 50 GB SSD / 2 TB transfer = $12/month;
> backups 20% (weekly) or 30% (daily) of the Droplet price; Spaces $5/month for 250 GB + 1 TB transfer.

```
Phone / laptop ──HTTPS──> Droplet (Bangalore, 2 GB)
                            ├─ Caddy      front door, free HTTPS certificate
                            ├─ app        Next.js website (Docker image from GitHub)
                            ├─ db         PostgreSQL (not reachable from the internet)
                            └─ backup     nightly database dump ──> Space
                          Space (private): form photos, KYC scans, database backups
GitHub push to main ──> GitHub Actions: test ──> build image ──> deploy over SSH
```

Expected bill: $12 (Droplet) + $2.40 (weekly Droplet backups) + $5 (Space) = **about $19.40/month** + tax [Unverified: GST on DigitalOcean invoices].

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
- **Enable backups**: weekly
- **Monitoring**: tick (free graphs and alerts)
- Hostname: `jainsangh-prod`
Create, wait until it shows an IP address. Write the IP down.

## 4. Firewall
**Networking** > **Firewalls** > **Create Firewall**, name `jainsangh-web`:
- Inbound: **SSH 22**, **HTTP 80**, **HTTPS 443** (all sources). Remove anything else.
- Apply to Droplet `jainsangh-prod`.

## 5. Space (file storage)
**Create** > **Spaces Object Storage**:
- Region: **Bangalore (BLR1)**
- CDN: **off**
- File listing: **Restricted** (private)
- Name: e.g. `jainsthanak-files` (must be unique)
Then **API** > **Spaces Keys** > **Generate New Key**, name `jainsangh-app`, limit access to this Space only if offered, read/write. Copy the **Access Key** and **Secret Key** into the password manager now (the secret is shown once).

## 6. Web address (Cloudflare DNS)
techshree.com's DNS is at Cloudflare. **dash.cloudflare.com** > techshree.com > **DNS** > **Records** > **Add record**:

| Type | Name | IPv4 address | Proxy status | TTL |
|---|---|---|---|---|
| A | `jainsthanak` | the Droplet IP | **DNS only** (grey cloud) | Auto |

Check from the Mac: `dig +short jainsthanak.techshree.com` prints the IP.

## 7. Prepare the server (one script)
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

## 8. Secrets file `/opt/jainsangh/.env`
On the server:
```
echo "POSTGRES_PASSWORD=\"$(openssl rand -hex 24)\""
echo "AUTH_SECRET=\"$(openssl rand -base64 36)\""
echo "AADHAAR_ENC_KEY=\"$(openssl rand -hex 32)\""
nano /opt/jainsangh/.env
```
Fill it like `.env.example`: the three values above, `APP_DOMAIN="jainsthanak.techshree.com"`, `STORAGE_DRIVER="s3"`, `S3_BUCKET`, `S3_ENDPOINT="https://blr1.digitaloceanspaces.com"`, `S3_REGION="us-east-1"`, the two Spaces keys, and for the first start only `SEED_ADMIN_MOBILE="7755998862"`, `SEED_ADMIN_PASSWORD="..."`, `SEED_ADMIN_NAME="Pratik Luniya"`.
Then:
```
chown deploy:deploy /opt/jainsangh/.env && chmod 600 /opt/jainsangh/.env
```
**Copy the whole `.env` into the password manager.** If `AADHAAR_ENC_KEY` is lost, stored Aadhaar numbers can never be read again; it is not in any backup on purpose.

## 9. Deploy key for GitHub Actions
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

## 10. First deploy (after the 5 Oct meeting)
1. Vercel > Project > Settings > Git > **Disconnect** (so Vercel stops building).
2. GitHub > Pull requests > New > base `main`, compare `aws` > **Merge**.
3. GitHub > **Actions** > `test-build-deploy`: test, build, deploy turn green.
4. Open https://jainsthanak.techshree.com, log in with the admin mobile and `SEED_ADMIN_PASSWORD`, then delete the `SEED_ADMIN_PASSWORD` line from `.env` and change the password in the app.

## 11. Check the backup works
```
ssh -i ~/.ssh/jainsangh_admin root@<Droplet IP>
cd /opt/jainsangh && docker compose exec backup backup.sh
```
It prints `[backup] uploaded jainsangh_<date>.sql.gz`; the file appears in the Space under `backups/`. From then on it runs nightly at 03:00 IST.

## 12. After go-live
After a week without problems: delete the Vercel project and the Supabase project (it holds demo forms and KYC scans).

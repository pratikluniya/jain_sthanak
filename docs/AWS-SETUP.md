# AWS Setup: Jain Sangh App

One-time setup of the production server on AWS Lightsail (Mumbai). Total time: about 1 to 1.5 hours.
Decided 3 Oct 2026: TechShree creates a separate AWS account for the Sangh and manages the bills.

> [Unverified] Menu names below are from my knowledge of the AWS Lightsail console and may have moved.
> Prices were checked on aws.amazon.com/lightsail/pricing on 3 Oct 2026: 2 GB plan $12/month, bucket $1/month for 5 GB, snapshots $0.05 per GB per month.

What you will have at the end:

```
Phone / laptop ──HTTPS──> Lightsail server (Mumbai, 2 GB)
                            ├─ Caddy      front door, free HTTPS certificate
                            ├─ app        Next.js website (Docker image from GitHub)
                            ├─ db         PostgreSQL (not reachable from the internet)
                            └─ backup     nightly database dump ──> Lightsail bucket
                          Lightsail bucket: form photos, KYC scans, backups (private)
GitHub push to main ──> GitHub Actions: test ──> build image ──> deploy over SSH
```

---

## 1. AWS account (once)

1. Go to https://aws.amazon.com and click **Create an AWS account**.
   - Email: **nashikroadjainsthanak@gmail.com** (decided 3 Oct 2026: one email for all Sangh services). Turn on 2-step verification on this Gmail too; whoever controls this inbox can reset the AWS password.
   - Account name: `Jain Sangh Nashik Road`.
   - Payment: TechShree card. AWS verifies the card with a small temporary charge [Unverified: amount varies].
   - Support plan: **Basic (free)**.
2. Sign in as the **root user**, then turn on MFA: account menu (top right) > **Security credentials** > **Assign MFA device** (an authenticator app on your phone).
3. Billing alarm: search **Billing and Cost Management** > **Budgets** > **Create budget** > **Monthly cost budget**, amount **USD 25**, email alert to you. You get an email if anything costs more than expected.

## 2. Server (Lightsail instance)

1. Open https://lightsail.aws.amazon.com.
2. **Create instance**:
   - Region: **Mumbai (ap-south-1)**, any zone.
   - Platform: **Linux/Unix**. Blueprint: **OS Only > Ubuntu 24.04 LTS**.
   - SSH key: keep the default key for this region.
   - Plan: **$12 USD** (2 GB memory, 2 vCPUs, 60 GB SSD).
   - Name: `jainsangh-prod`.
3. **Static IP** (so the address never changes): instance > **Networking** > **Attach static IP** > name `jainsangh-ip`. Free while attached to a running instance. Write the IP down.
4. **Firewall**: instance > **Networking** > **IPv4 Firewall** > make sure there are rules for **SSH (22)**, **HTTP (80)** and **HTTPS (443)**. Add HTTPS if missing.
5. **Automatic snapshots** (whole-server backup): instance > **Snapshots** > turn on **Automatic snapshots**. Lightsail keeps the last 7 daily snapshots.

## 3. Bucket (photos, scans, backups)

1. Lightsail > **Storage** > **Create bucket**.
   - Region: **Mumbai**. Plan: **5 GB ($1/month)**. Name: e.g. `jainsangh-files-<random>` (must be unique worldwide).
2. Bucket > **Permissions**: keep **All objects are private**. Never make it public.
3. Bucket > **Permissions** > **Access keys** > **Create access key**. Copy the **Access key ID** and **Secret access key** now. The secret is shown only once; put it in your password manager.

## 4. Web address (DNS)

Address: **jainsthanak.techshree.com** (decided 3 Oct 2026).
techshree.com is registered at GoDaddy, but its DNS is managed at **Cloudflare** (nameservers `kolton.ns.cloudflare.com` and `dayana.ns.cloudflare.com`, checked 3 Oct 2026). So the record is added in Cloudflare, not GoDaddy:

1. https://dash.cloudflare.com > **techshree.com** > **DNS** > **Records** > **Add record**.
2. Fill in:

| Type | Name | IPv4 address | Proxy status | TTL |
|---|---|---|---|---|
| A | `jainsthanak` | the static IP from step 2.3 | **DNS only** (grey cloud, not orange) | Auto |

3. Save. The main website on Cloudflare Pages is not affected; this adds a new name only.

Why "DNS only": Caddy on the server gets its own free HTTPS certificate. With the orange cloud (Cloudflare proxy) on, Cloudflare sits in between and needs extra SSL settings. Keep it simple: grey cloud.

Check from the Mac after a few minutes: `dig +short jainsthanak.techshree.com` should print the static IP.

## 5. First login to the server

Easiest: Lightsail > instance > **Connect using SSH** (opens a terminal in the browser).

From the Mac instead: Lightsail > **Account** > **SSH keys** > download the default key for Mumbai, then:
```
chmod 600 ~/Downloads/LightsailDefaultKey-ap-south-1.pem
ssh -i ~/Downloads/LightsailDefaultKey-ap-south-1.pem ubuntu@<static IP>
```

## 6. Prepare the server (one script)

On the server:
```
curl -fsSLo server-setup.sh https://raw.githubusercontent.com/pratikluniya/jain_sthanak/main/scripts/server-setup.sh
```
The repo is private, so that link only works with a token. Simpler: open `scripts/server-setup.sh` on GitHub, copy its text, and on the server run `nano server-setup.sh`, paste, save (Ctrl+O, Enter, Ctrl+X). Then:
```
bash server-setup.sh
exit
```
Log in again (the `docker` group applies at the next login). The script installs Docker, a 2 GB swap file, the firewall, automatic security updates, a log size limit and the folder `/opt/jainsangh`.

## 7. Secrets file `/opt/jainsangh/.env`

On the server, generate the secrets:
```
echo "POSTGRES_PASSWORD=\"$(openssl rand -hex 24)\""
echo "AUTH_SECRET=\"$(openssl rand -base64 36)\""
echo "AADHAAR_ENC_KEY=\"$(openssl rand -hex 32)\""
```
Then `nano /opt/jainsangh/.env` and fill it like `.env.example`:
```
POSTGRES_PASSWORD="..."          # from above
APP_DOMAIN="jainsthanak.techshree.com"
STORAGE_DRIVER="s3"
S3_BUCKET="jainsangh-files-..."
S3_REGION="ap-south-1"
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
AUTH_SECRET="..."                # from above
AADHAAR_ENC_KEY="..."            # from above. NEVER change after Aadhaar numbers are saved
ANTHROPIC_API_KEY=""             # empty until go-live
CLAUDE_MODEL="claude-sonnet-4-5"
SEED_ADMIN_MOBILE="7755998862"   # first start only
SEED_ADMIN_PASSWORD="..."        # first start only, 8+ characters; delete this line after the first login
SEED_ADMIN_NAME="Pratik Luniya"
```
Protect it: `chmod 600 /opt/jainsangh/.env`.

**Copy the whole `.env` into your password manager now.** If `AADHAAR_ENC_KEY` is lost, the stored Aadhaar numbers can never be read again; it is not inside the database backups on purpose.

## 8. Deploy key for GitHub Actions

On the Mac:
```
ssh-keygen -t ed25519 -f ~/.ssh/jainsangh_deploy -C "github-actions-deploy" -N ""
cat ~/.ssh/jainsangh_deploy.pub
```
On the server, add that one line to the allowed keys:
```
nano ~/.ssh/authorized_keys      # paste the .pub line at the end, save
```
On GitHub: repo > **Settings** > **Secrets and variables** > **Actions** > **New repository secret**, three times:

| Name | Value |
|---|---|
| `SSH_HOST` | the static IP |
| `SSH_USER` | `ubuntu` |
| `SSH_KEY` | the whole content of `~/.ssh/jainsangh_deploy` (the file WITHOUT .pub), including the BEGIN and END lines |

## 9. First deploy

1. After the 5 Oct meeting, merge the `aws` branch into `main` (GitHub > **Pull requests** > **New** > base `main`, compare `aws` > **Merge**). This also stops being what Vercel shows: disconnect the project in Vercel first (Vercel > Project > Settings > Git > Disconnect) so Vercel does not try to build the Docker version.
2. GitHub > **Actions** > **test-build-deploy**: it runs by itself after the merge (or press **Run workflow**). Three jobs: test, build, deploy. Each turns green.
3. Open `https://jainsthanak.techshree.com`. The first visit can take a few seconds while Caddy gets the HTTPS certificate.
4. Log in with the admin mobile and the `SEED_ADMIN_PASSWORD`, then **delete the `SEED_ADMIN_PASSWORD` line** from `/opt/jainsangh/.env`. Change the password in the app (Users).
5. Settings: check the age cut-off date (01/10/2026), Sangh name, address, receipt purposes.

## 10. Check the backup works

On the server:
```
cd /opt/jainsangh
docker compose exec backup backup.sh
```
It should print `[backup] uploaded jainsangh_<date>.sql.gz`. In Lightsail > bucket > **Objects** > `backups/` you see the file. From then on it runs every night at 03:00 India time.

## 11. After go-live: Vercel and Supabase

When the AWS app has been in use for a week without problems:
- Vercel: delete the project (the demo address `jain-sthanak.vercel.app` stops).
- Supabase: export anything you still want, then delete the project. It holds the demo forms and KYC scans, so do not leave it lying around.

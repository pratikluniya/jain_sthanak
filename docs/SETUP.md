# Account Setup: Jain Sangh Dashboard

All accounts under TechShree (pratik@techshree.com). Total time: about 30 to 45 minutes.

> [Unverified] Screen names and menu paths below are from my knowledge of these services and may have changed. Prices and plan limits must be confirmed on each site.

---

## 0. Unblock package downloads

Done: all domains allowed (27 Sep).

---

## 1. GitHub (code storage)

1. Go to https://github.com and sign in with the TechShree account.
2. Click **New repository**.
   - Name: `jain_sthanak`
   - Visibility: **Private**
   - Do NOT add a README (the code already has one).
3. Repo: **https://github.com/pratikluniya/jain_sthanak** (done). The code is in your `JainStanak/jainsangh` folder; push it from your Mac Terminal with:
   ```
   cd ~/Downloads/Clients/JainStanak/jainsangh
   git init && git add . && git commit -m "Initial version"
   git branch -M main
   git remote add origin https://github.com/pratikluniya/jain_sthanak.git
   git push -u origin main
   ```

---

## 2. Supabase (database + file storage)

1. Go to https://supabase.com, sign up with GitHub (TechShree account).
2. **New project**:
   - Name: `jainsangh`
   - Database password: generate a strong one and **save it in your password manager**
   - Region: **Mumbai (ap-south-1)**, closest to Nashik
   - Plan: Free
3. When the project is ready, open **Connect** (top bar) > **ORMs** > choose **Prisma**:
   - It shows a `.env` block with `DATABASE_URL` (port 6543) and `DIRECT_URL` (port 5432). Copy both lines into `.env`.
   - If `DATABASE_URL` does not already end with `?pgbouncer=true`, add `?pgbouncer=true&connection_limit=1`.
   - Replace `[YOUR-PASSWORD]` in both with the password from step 2.
4. **Storage** > **New bucket**:
   - `forms` (Private) for form photos
   - `kyc` (Private) for Aadhaar scans
5. **Project Settings** > **API**:
   - Copy **Project URL**. This becomes `SUPABASE_URL`.
   - Copy the **service_role** secret key. This becomes `SUPABASE_SERVICE_ROLE_KEY`. **Never share this key or put it in frontend code.**

> [Unverified] The free tier pauses a project after about 1 week of no activity. Before the election you may want the paid plan; check current pricing.

---

## 3. Anthropic API (AI form reading)

1. Go to https://console.anthropic.com and sign up with pratik@techshree.com.
2. **Billing**: add a card and buy a small credit (e.g. USD 10 to 20 is plenty for testing).
3. **Limits**: set a **monthly spend limit** (e.g. USD 10) so costs can never run away.
4. **API Keys** > **Create Key**, name it `jainsangh-prod`. Copy it once (it is shown only once). This becomes `ANTHROPIC_API_KEY`.

> [Inference] Reading one form photo costs a few US cents at most. I will measure the real cost on the sample forms and report it.

---

## 4. Vercel (hosting, free subdomain)

1. Go to https://vercel.com, sign up with **Continue with GitHub** (TechShree account).
2. After the code is pushed (step 1): **Add New** > **Project** > import `jain_sthanak`.
3. Before clicking Deploy, open **Environment Variables** and add every variable from section 5.
4. Click **Deploy**. You get a free address like `jain-sthanak.vercel.app`.

> [Unverified] Vercel's free Hobby plan is meant for personal, non-commercial use. Hosting a client project under TechShree may require the Pro plan (paid, per seat). Please check Vercel's current terms. Alternatives if needed: Netlify, Render, or a small VPS.

---

## 5. The `.env` file (keys go here, never in chat)

Create a file named `.env` inside `JainStanak/jainsangh/` with:

```
DATABASE_URL="postgresql://...:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://...:5432/postgres"
SUPABASE_URL="https://xxxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="..."
ANTHROPIC_API_KEY="sk-ant-..."
AUTH_SECRET="<I will generate this>"
AADHAAR_ENC_KEY="<I will generate this>"
```

I will create `.env.example` with the two generated secrets filled in. You copy it to `.env` and paste the rest. The `.env` file is excluded from Git so keys never reach GitHub.

---

## Checklist

- [x] npm / pypi hosts allowed
- [x] GitHub private repo created
- [ ] Supabase project (Mumbai) + `forms` and `kyc` buckets
- [ ] Anthropic API key + spend limit
- [ ] Vercel account linked to GitHub
- [ ] `.env` filled in

# Deploy Pawps PH online — step by step

Your Turso database URL:

```
libsql://pawps-ph-youjaezz.aws-ap-northeast-1.turso.io
```

The build error **`no such table: customers`** means the database tables were never created on Turso. Follow every step below in order.

---

## Step 1 — Get your Turso auth token

1. Go to [turso.tech/app](https://turso.tech/app) and sign in.
2. Open your database **`pawps-ph`**.
3. Click **Tokens** (or **Create Token**).
4. Copy the token — it looks like a long string starting with `eyJ...`.

You need **both** the URL above **and** this token.

---

## Step 2 — Add environment variables on Vercel

1. Open [vercel.com](https://vercel.com) → your project.
2. Go to **Settings** → **Environment Variables**.
3. Add **all** of these (check **Production**, **Preview**, and **Development**):

| Name | Value |
|------|--------|
| `DATABASE_URL` | `libsql://pawps-ph-youjaezz.aws-ap-northeast-1.turso.io` |
| `DATABASE_AUTH_TOKEN` | *(paste your Turso token from Step 1)* |
| `SESSION_SECRET` | Any random string, **32+ characters** (e.g. `PawpsMontalban2026SecretKeyChangeMe!!`) |
| `ADMIN_EMAIL` | `xjaequeral@gmail.com` |
| `ADMIN_PASSWORD` | `092925` *(change in Settings after first login)* |

4. Click **Save**.

---

## Step 3 — Push the latest code to GitHub

The project now runs migrations **automatically before each build**.

```powershell
cd "E:\Programmed Applications\The PAWps PH\pet-pro-manager"
git add .
git commit -m "Fix deploy: auto-migrate Turso before build"
git push
```

---

## Step 4 — Redeploy on Vercel

1. Vercel → your project → **Deployments**.
2. Click **⋯** on the latest deployment → **Redeploy**.
3. Watch the build logs — you should see:
   - `Migrating database: libsql://...`
   - `✓ Migrations complete`
   - then `next build` succeeding.

If migrate fails with **DATABASE_AUTH_TOKEN is required**, go back to Step 2 and add the token.

---

## Step 5 — (Optional) Migrate from your PC first

If you prefer to create tables before redeploying:

```powershell
cd "E:\Programmed Applications\The PAWps PH\pet-pro-manager"

$env:DATABASE_URL="libsql://pawps-ph-youjaezz.aws-ap-northeast-1.turso.io"
$env:DATABASE_AUTH_TOKEN="PASTE_YOUR_TURSO_TOKEN_HERE"
$env:ADMIN_EMAIL="xjaequeral@gmail.com"
$env:ADMIN_PASSWORD="092925"

npm run db:migrate
```

You should see `✓ Migrations complete` and `Seeded admin user: xjaequeral@gmail.com`.

Then redeploy on Vercel (Step 4).

---

## Step 6 — Open your site and sign in

1. Open your Vercel URL (e.g. `https://pawps-ph.vercel.app`).
2. You’ll land on **/login**.
3. Sign in:
   - **Email:** `xjaequeral@gmail.com`
   - **Password:** `092925`
4. Go to **Settings** → change your password.

---

## Free hosting summary

| Service | What | Cost |
|---------|------|------|
| **Vercel** | Hosts the Next.js app | Free (`*.vercel.app`) |
| **Turso** | Cloud database (your URL above) | Free tier |
| **Domain** | Vercel gives `your-project.vercel.app` | Free |

Custom domain (e.g. `pawps.ph`) is optional — buy from Cloudflare/Namecheap later and add it in Vercel → **Domains**.

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `no such table: customers` | Run Step 5 locally, or redeploy after Step 2 env vars are set |
| `DATABASE_AUTH_TOKEN is required` | Add token in Vercel env vars (Step 2) |
| Build fails on migrate | Ensure `DATABASE_URL` and `DATABASE_AUTH_TOKEN` are set for **Production** |
| Login fails | Re-run migrate with `ADMIN_EMAIL` / `ADMIN_PASSWORD` set |

---

## Note: supplier PDF uploads

PDF uploads save to disk, which **does not persist on Vercel**. Inventory, orders, customers, and reports work online. Supplier catalog uploads need cloud storage later if you want them on the live site.

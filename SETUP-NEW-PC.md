# New PC setup — Pawps PH (pet-pro-manager)

Install these once on a fresh Windows PC, then run the app locally.

## 1. Install software

| Tool | Download | Why |
|------|----------|-----|
| **Node.js 20 LTS** | [nodejs.org](https://nodejs.org/) | Runs Next.js (`npm`) |
| **Git** | [git-scm.com](https://git-scm.com/download/win) | Push to GitHub / Vercel deploy |
| **Cursor** (optional) | [cursor.com](https://cursor.com/) | Same editor you use now |

After installing Node, open **PowerShell** and check:

```powershell
node -v
npm -v
git --version
```

You should see Node `v20.x` or newer.

## 2. Open the project

```powershell
cd "C:\Users\Pawps PH\Documents\SYSTEMS\The PAWps PH\pet-pro-manager"
npm install
```

## 3. Local environment file

Copy the example env and edit secrets locally (never commit `.env.local`):

```powershell
copy .env.example .env.local
```

In `.env.local` keep at minimum:

- `DATABASE_URL=file:./db.sqlite`
- `SESSION_SECRET=` a random string **32+ characters**
- `ADMIN_EMAIL=` your login email
- `ADMIN_PASSWORD=` your login password

Optional:

- `ANTHROPIC_API_KEY=` only if you use AI pricelist scanning
- `NEXT_PUBLIC_SITE_URL=` your Vercel URL when testing tracking links

## 4. Database & run

```powershell
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## 5. Deploy online

See **[DEPLOY.md](./DEPLOY.md)** for Vercel + Turso environment variables and redeploy steps.

## What you can edit in the app (manual fixes)

- **Inventory** → **Edit** on each row (name, brand, flavor, prices, supplier)
- **Suppliers** → **Edit** on supplier list; **Edit** on each catalog row
- **Sales & Orders** → **Edit** on an order (sale unit: Piece / Kilogram / Pack, qty, price tier, store type)

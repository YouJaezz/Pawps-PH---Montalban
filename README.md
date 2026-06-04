# Pawps PH — Montalban

Pet supply ERP for inventory, orders, suppliers, delivery, and reports.

## New PC?

See **[SETUP-NEW-PC.md](./SETUP-NEW-PC.md)** (Node, Git, `npm install`, `.env.local`).

## Local run

```bash
npm install
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy (Vercel + Turso)

See **[DEPLOY.md](./DEPLOY.md)** for environment variables and redeploy steps.

## Manual edits (no AI required)

- **Inventory** — Edit per product row
- **Suppliers** — Edit supplier info and catalog rows
- **Orders** — Edit sale unit (piece / kilogram / pack), quantities, and order details

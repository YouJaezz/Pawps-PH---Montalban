import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { eq, sql } from "drizzle-orm";

import { investorAgreements, investors, users } from "./schema";
import { hashPassword } from "../lib/password";

const MIGRATIONS_TABLE = "__drizzle_migrations";

function isAlreadyAppliedError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("duplicate column name") ||
    msg.includes("already exists") ||
    msg.includes("duplicate column")
  );
}

async function ensureMigrationsTable(client: Client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash text NOT NULL,
      created_at numeric
    )
  `);
}

async function getLastMigrationMillis(client: Client) {
  const result = await client.execute(
    `SELECT created_at FROM ${MIGRATIONS_TABLE} ORDER BY created_at DESC LIMIT 1`,
  );
  const row = result.rows[0];
  if (!row) return 0;
  return Number(row.created_at ?? 0);
}

async function runStatement(client: Client, statement: string) {
  const trimmed = statement.trim();
  if (!trimmed) return;
  try {
    await client.execute(trimmed);
  } catch (err) {
    if (isAlreadyAppliedError(err)) {
      console.warn(`Skipping already-applied schema change: ${trimmed.slice(0, 80)}…`);
      return;
    }
    throw err;
  }
}

async function applyMigrations(client: Client) {
  await ensureMigrationsTable(client);
  const lastApplied = await getLastMigrationMillis(client);
  const migrations = readMigrationFiles({ migrationsFolder: "drizzle" });

  for (const migration of migrations) {
    if (migration.folderMillis <= lastApplied) continue;

    console.log(`Applying migration ${migration.folderMillis}…`);
    for (const statement of migration.sql) {
      await runStatement(client, statement);
    }

    await client.execute({
      sql: `INSERT INTO ${MIGRATIONS_TABLE} (hash, created_at) VALUES (?, ?)`,
      args: [migration.hash, migration.folderMillis],
    });
  }
}

async function seedAdminUser(db: ReturnType<typeof drizzle>) {
  const rows = await db.select({ count: sql<number>`count(*)` }).from(users);
  if (Number(rows[0]?.count ?? 0) > 0) return;

  const email = (
    process.env.ADMIN_EMAIL ?? "xjaequeral@gmail.com"
  ).trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "092925";

  await db.insert(users).values({
    email,
    name: "Admin",
    passwordHash: await hashPassword(password),
    role: "admin",
  });

  console.log(`Seeded admin user: ${email}`);
}

async function seedDefaultInvestor(db: ReturnType<typeof drizzle>) {
  const investorCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(investors);
  const hasInvestors = Number(investorCount[0]?.count ?? 0) > 0;

  if (!hasInvestors) {
    const [inv] = await db
      .insert(investors)
      .values({
        fullName: "Primary Investor",
        contact: null,
        email: null,
        address: null,
        notes: "Update profile with investor legal name and contact details.",
      })
      .returning({ id: investors.id });

    if (inv) {
      await db.insert(investorAgreements).values({
        investorId: inv.id,
        agreementHolder: "The PAWps PH — Montalban",
        capitalCents: 5_000_000,
        sharePercent: 10,
        agreementDate: new Date(),
        effectiveFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        termsNotes:
          "10% of monthly net income (paid sales revenue minus COGS) in exchange for ₱50,000 capital contribution.",
      });
      console.log("Seeded default investor (₱50,000 · 10% share)");
    }
    return;
  }

  // Ensure existing investors without an agreement get a default one
  const allInvestors = await db
    .select({ id: investors.id })
    .from(investors)
    .where(eq(investors.active, true));

  for (const inv of allInvestors) {
    const [existingAgreement] = await db
      .select({ id: investorAgreements.id })
      .from(investorAgreements)
      .where(eq(investorAgreements.investorId, inv.id))
      .limit(1);

    if (!existingAgreement) {
      await db.insert(investorAgreements).values({
        investorId: inv.id,
        agreementHolder: "The PAWps PH — Montalban",
        capitalCents: 5_000_000,
        sharePercent: 10,
        agreementDate: new Date(),
        effectiveFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        termsNotes:
          "10% of monthly net income from collected sales minus COGS.",
      });
      console.log(`Added default agreement for investor #${inv.id}`);
    }
  }
}

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./db.sqlite";
  const authToken = process.env.DATABASE_AUTH_TOKEN;

  if (url.startsWith("libsql://") && !authToken) {
    console.error(
      "\n❌ Turso requires DATABASE_AUTH_TOKEN.\n" +
        "   Get it from https://turso.tech → your database → Tokens\n" +
        "   Add it in Vercel → Settings → Environment Variables\n",
    );
    process.exit(1);
  }

  console.log(`Migrating database: ${url.replace(/\/\/.*@/, "//***@")}`);

  const client = createClient(
    authToken ? { url, authToken } : { url },
  );
  const db = drizzle(client);

  await applyMigrations(client);
  await seedAdminUser(db);
  await seedDefaultInvestor(db);

  client.close();
  console.log("✓ Migrations complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

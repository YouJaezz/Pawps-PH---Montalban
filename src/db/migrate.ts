import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { sql } from "drizzle-orm";

import { users } from "./schema";
import { hashPassword } from "../lib/password";

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

  await migrate(db, { migrationsFolder: "drizzle" });
  await seedAdminUser(db);

  client.close();
  console.log("✓ Migrations complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

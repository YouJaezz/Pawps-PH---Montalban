import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./db.sqlite";
  const client = createClient({ url });
  const db = drizzle(client);

  await migrate(db, { migrationsFolder: "drizzle" });

  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


if (typeof window !== "undefined") {
  throw new Error("Database client cannot be imported in the browser.");
}

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:./db.sqlite";
const authToken = process.env.DATABASE_AUTH_TOKEN;

const client = createClient(
  authToken ? { url, authToken } : { url },
);

export const db = drizzle(client, { schema });

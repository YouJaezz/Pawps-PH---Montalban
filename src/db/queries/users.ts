import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function findUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      name: users.name,
      role: users.role,
      active: users.active,
    })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);
  return row ?? null;
}

export async function findUserById(id: number) {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      name: users.name,
      role: users.role,
      active: users.active,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return row ?? null;
}

export async function listUsers() {
  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      active: users.active,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.email);
}

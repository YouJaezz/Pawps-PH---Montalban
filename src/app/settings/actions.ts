"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { listUsers, findUserById } from "@/db/queries/users";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guard";
import { hashPassword, verifyPassword } from "@/lib/password";
import { eq } from "drizzle-orm";

export type SettingsActionResult = {
  ok?: boolean;
  error?: string;
  message?: string;
};

export async function changeOwnPassword(
  _prev: SettingsActionResult | null,
  formData: FormData,
): Promise<SettingsActionResult> {
  const session = await requireAdmin();
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!current || !next) {
    return { error: "Enter current and new password." };
  }
  if (next.length < 6) {
    return { error: "New password must be at least 6 characters." };
  }
  if (next !== confirm) {
    return { error: "New passwords do not match." };
  }

  const user = await findUserById(session.userId);
  if (!user) return { error: "Account not found." };

  const valid = await verifyPassword(current, user.passwordHash);
  if (!valid) return { error: "Current password is incorrect." };

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(next) })
    .where(eq(users.id, session.userId));

  revalidatePath("/settings");
  return { ok: true, message: "Password updated." };
}

export async function createAccount(
  _prev: SettingsActionResult | null,
  formData: FormData,
): Promise<SettingsActionResult> {
  await requireAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const roleRaw = String(formData.get("role") ?? "staff");
  const role = roleRaw === "admin" ? "admin" : "staff";

  if (!email || !password) {
    return { error: "Email and password are required." };
  }
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const existing = await listUsers();
  if (existing.some((u) => u.email.toLowerCase() === email)) {
    return { error: "An account with this email already exists." };
  }

  await db.insert(users).values({
    email,
    name: name || null,
    passwordHash: await hashPassword(password),
    role,
  });

  revalidatePath("/settings");
  return { ok: true, message: `Account created for ${email}.` };
}

export async function toggleAccountActive(formData: FormData) {
  const session = await requireAdmin();
  const userId = Number.parseInt(String(formData.get("userId") ?? ""), 10);
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new Error("Invalid user.");
  }
  if (userId === session.userId) {
    throw new Error("You cannot deactivate your own account.");
  }

  const user = await findUserById(userId);
  if (!user) throw new Error("User not found.");

  await db
    .update(users)
    .set({ active: !user.active })
    .where(eq(users.id, userId));

  revalidatePath("/settings");
}

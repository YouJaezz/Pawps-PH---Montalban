"use server";

import { redirect } from "next/navigation";

import { findUserByEmail } from "@/db/queries/users";
import {
  defaultPathForRole,
  isCashierPathAllowed,
  normalizeRole,
} from "@/lib/roles";
import { verifyPassword } from "@/lib/password";
import { clearSessionCookie, setSessionCookie } from "@/lib/session";

export type LoginState = {
  error?: string;
};

export async function loginAction(
  _prev: LoginState | null,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nextPath = String(formData.get("next") ?? "/").trim() || "/";

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const user = await findUserByEmail(email);
  if (!user || !user.active) {
    return { error: "Invalid email or password." };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { error: "Invalid email or password." };
  }

  await setSessionCookie({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: normalizeRole(user.role),
  });

  const role = normalizeRole(user.role);
  let destination = nextPath.startsWith("/") ? nextPath : "/";
  if (role === "cashier" && !isCashierPathAllowed(destination)) {
    destination = defaultPathForRole(role);
  }

  redirect(destination);
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}

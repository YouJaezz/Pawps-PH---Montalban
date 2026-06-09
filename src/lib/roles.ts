import type { UserRole } from "@/db/schema";

/** Normalize legacy JWT / DB values (`staff` → cashier). */
export function normalizeRole(raw: string | undefined | null): UserRole {
  return raw === "admin" ? "admin" : "cashier";
}

export function isAdmin(role: string | undefined | null) {
  return normalizeRole(role) === "admin";
}

export function isCashier(role: string | undefined | null) {
  return !isAdmin(role);
}

export function roleLabel(role: string | undefined | null) {
  return isAdmin(role) ? "Admin" : "Cashier";
}

export const CASHIER_HOME = "/orders";

/** Routes a cashier may open (sales + inventory add + customers for checkout). */
export function isCashierPathAllowed(pathname: string) {
  if (pathname === "/orders" || pathname.startsWith("/orders/")) return true;
  if (pathname === "/products") return true;
  if (pathname === "/customers") return true;
  return false;
}

/** Admin-only page prefixes (financial, ops, confidential). */
export function isAdminOnlyPath(pathname: string) {
  if (pathname === "/" || pathname.startsWith("/settings")) return true;
  if (pathname.startsWith("/investors")) return true;
  if (pathname.startsWith("/reports")) return true;
  if (pathname.startsWith("/suppliers")) return true;
  if (pathname.startsWith("/delivery")) return true;
  if (pathname.startsWith("/preorders")) return true;
  if (pathname.startsWith("/transport")) return true;
  if (pathname.startsWith("/pos")) return true;
  if (pathname.startsWith("/api/export")) return true;
  return false;
}

export function defaultPathForRole(role: string | undefined | null) {
  return isAdmin(role) ? "/" : CASHIER_HOME;
}

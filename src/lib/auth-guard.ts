import { getSession, type SessionUser } from "@/lib/session";
import { isAdmin } from "@/lib/roles";

export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new Error("Please sign in to continue.");
  }
  return session;
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireAuth();
  if (!isAdmin(session.role)) {
    throw new Error("Admin access required.");
  }
  return session;
}

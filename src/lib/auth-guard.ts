import { getSession, type SessionUser } from "@/lib/session";

export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new Error("Please sign in to continue.");
  }
  return session;
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireAuth();
  if (session.role !== "admin") {
    throw new Error("Admin access required.");
  }
  return session;
}

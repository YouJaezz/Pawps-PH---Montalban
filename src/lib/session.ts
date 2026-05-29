import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "pawps_session";
const SESSION_DAYS = 7;

export type SessionUser = {
  userId: number;
  email: string;
  name: string | null;
  role: "admin" | "staff";
};

function getSecret() {
  const secret =
    process.env.SESSION_SECRET ??
    (process.env.NODE_ENV === "production" ? undefined : "dev-only-change-me-please");
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET must be set (min 16 characters). Add it to .env.local",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({
    userId: user.userId,
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const userId = Number(payload.userId);
    if (!Number.isFinite(userId) || userId <= 0) return null;
    const email = String(payload.email ?? "");
    const role = payload.role === "admin" ? "admin" : "staff";
    if (!email) return null;
    return {
      userId,
      email,
      name: payload.name ? String(payload.name) : null,
      role,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function setSessionCookie(user: SessionUser) {
  const token = await createSessionToken(user);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/session";

const PUBLIC_PATHS = ["/login"];

function getSecret() {
  return new TextEncoder().encode(
    process.env.SESSION_SECRET ?? "dev-only-change-me-please",
  );
}

async function readSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const userId = Number(payload.userId);
    if (!Number.isFinite(userId) || userId <= 0) return null;
    return {
      userId,
      role: payload.role === "admin" ? ("admin" as const) : ("staff" as const),
    };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    if (pathname.startsWith("/login")) {
      const session = await readSession(request);
      if (session) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
    return NextResponse.next();
  }

  const session = await readSession(request);
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/settings") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};

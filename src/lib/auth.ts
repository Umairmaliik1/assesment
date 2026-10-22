import { eq } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { users, type User } from "@/db/schema";
import { HttpError } from "./http";

export const SESSION_COOKIE = "session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return new TextEncoder().encode(secret);
  if (process.env.VERCEL) throw new Error("SESSION_SECRET must be set to at least 32 characters");
  return new TextEncoder().encode("local-development-secret-not-for-production");
}

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
} as const;

async function userFromToken(token: string | undefined): Promise<User | null> {
  if (!token) return null;
  const payload = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] }).then(
    (result) => result.payload,
    () => null,
  );
  if (!payload?.sub) return null;
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, payload.sub));
  return user ?? null;
}

export async function getCurrentUser(): Promise<User | null> {
  return userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function requireUser(req: NextRequest): Promise<User> {
  const user = await userFromToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!user) throw new HttpError(401, "Please sign in");
  return user;
}

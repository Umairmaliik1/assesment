import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { HttpError, readJson, route } from "@/lib/http";
import { loginInput } from "@/lib/validation";

export const POST = route(async (req) => {
  const { userId } = await readJson(req, loginInput);
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new HttpError(404, "User not found");
  const res = NextResponse.json({ user });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(user.id), sessionCookieOptions);
  return res;
});

export const DELETE = route(async () => {
  const res = new NextResponse(null, { status: 204 });
  res.cookies.delete(SESSION_COOKIE);
  return res;
});

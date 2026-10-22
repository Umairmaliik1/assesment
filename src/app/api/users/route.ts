import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listOtherUsers } from "@/lib/documents";
import { route } from "@/lib/http";

export const GET = route(async (req) => {
  const user = await requireUser(req);
  return NextResponse.json({ users: await listOtherUsers(user.id) });
});

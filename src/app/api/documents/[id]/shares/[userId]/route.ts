import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { revokeShare } from "@/lib/documents";
import { route } from "@/lib/http";

type Ctx = { params: Promise<{ id: string; userId: string }> };

export const DELETE = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { id, userId } = await params;
  await revokeShare(id, user.id, userId);
  return new NextResponse(null, { status: 204 });
});

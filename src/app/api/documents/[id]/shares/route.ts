import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listShares, shareDocument } from "@/lib/documents";
import { readJson, route } from "@/lib/http";
import { shareInput } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  return NextResponse.json({ shares: await listShares((await params).id, user.id) });
});

export const PUT = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { userId, role } = await readJson(req, shareInput);
  const { id } = await params;
  await shareDocument(id, user.id, userId, role);
  return NextResponse.json({ shares: await listShares(id, user.id) });
});

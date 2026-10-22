import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { deleteDocument, getDocument, renameDocument, saveContent } from "@/lib/documents";
import { readJson, route } from "@/lib/http";
import { updateDocumentInput } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  return NextResponse.json(await getDocument((await params).id, user.id));
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { id } = await params;
  const input = await readJson(req, updateDocumentInput);
  if ("title" in input) {
    await renameDocument(id, user.id, input.title);
    return NextResponse.json({ title: input.title });
  }
  return NextResponse.json(await saveContent(id, user.id, input.content, input.baseVersion));
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  await deleteDocument((await params).id, user.id);
  return new NextResponse(null, { status: 204 });
});

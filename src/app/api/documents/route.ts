import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createDocument, listDocuments } from "@/lib/documents";
import { readJson, route } from "@/lib/http";
import { createDocumentInput } from "@/lib/validation";

export const GET = route(async (req) => {
  const user = await requireUser(req);
  return NextResponse.json(await listDocuments(user.id));
});

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const { title } = await readJson(req, createDocumentInput);
  return NextResponse.json(await createDocument(user.id, title), { status: 201 });
});

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createDocument } from "@/lib/documents";
import { HttpError, route } from "@/lib/http";
import { fileToDocument } from "@/lib/import";

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const form = await req.formData().catch(() => {
    throw new HttpError(400, "Upload must be multipart form data");
  });
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Choose a file to import");
  const { title, content } = await fileToDocument(file.name, Buffer.from(await file.arrayBuffer()));
  return NextResponse.json(await createDocument(user.id, title, content), { status: 201 });
});

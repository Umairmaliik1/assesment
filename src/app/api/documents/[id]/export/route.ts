import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDocument } from "@/lib/documents";
import { attachmentHeader } from "@/lib/export/filename";
import { documentToMarkdown } from "@/lib/export/markdown";
import { documentToPdf } from "@/lib/export/pdf";
import { route } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

const formatSchema = z.enum(["pdf", "md"], { error: "Format must be pdf or md" });

export const GET = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const format = formatSchema.parse(req.nextUrl.searchParams.get("format"));
  const { title, content } = await getDocument((await params).id, user.id);
  const body = format === "pdf" ? Buffer.from(await documentToPdf(title, content)) : documentToMarkdown(content);
  return new Response(body, {
    headers: {
      "content-type": format === "pdf" ? "application/pdf" : "text/markdown; charset=utf-8",
      "content-disposition": attachmentHeader(title, format),
      "cache-control": "no-store",
    },
  });
});

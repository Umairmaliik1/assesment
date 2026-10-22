import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { DocumentEditor } from "@/components/document-editor";
import { getCurrentUser } from "@/lib/auth";
import { getDocument } from "@/lib/documents";
import { HttpError } from "@/lib/http";

type Props = { params: Promise<{ id: string }> };

const load = cache(async (id: string) => {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const doc = await getDocument(id, user.id).catch((error) => {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  });
  return { user, doc };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: (await load((await params).id)).doc.title };
}

export default async function DocumentPage({ params }: Props) {
  const { user, doc } = await load((await params).id);
  const { id, title, content, version, role, ownerName } = doc;
  return <DocumentEditor key={`${id}:${version}`} user={user} doc={{ id, title, content, version, role, ownerName }} />;
}

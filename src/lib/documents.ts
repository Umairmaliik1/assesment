import type { JSONContent } from "@tiptap/core";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { documents, documentShares, users, type ShareRole } from "@/db/schema";
import { can, type Action, type Role } from "./access";
import { HttpError } from "./http";
import { EMPTY_DOC, idSchema } from "./validation";

async function loadWithRole(docId: string, userId: string) {
  if (!idSchema.safeParse(docId).success) return null;
  const db = await getDb();
  const [row] = await db
    .select({
      id: documents.id,
      title: documents.title,
      content: documents.content,
      version: documents.version,
      updatedAt: documents.updatedAt,
      ownerId: documents.ownerId,
      ownerName: users.name,
      shareRole: documentShares.role,
    })
    .from(documents)
    .innerJoin(users, eq(users.id, documents.ownerId))
    .leftJoin(documentShares, and(eq(documentShares.documentId, documents.id), eq(documentShares.userId, userId)))
    .where(eq(documents.id, docId));
  if (!row) return null;
  const { shareRole, ...doc } = row;
  const role: Role | null = doc.ownerId === userId ? "owner" : shareRole;
  return role ? { ...doc, role } : null;
}

// Users without any access get 404 so document ids cannot be probed.
async function authorize(docId: string, userId: string, action: Action) {
  const doc = await loadWithRole(docId, userId);
  if (!doc) throw new HttpError(404, "Document not found");
  if (!can(doc.role, action)) throw new HttpError(403, "You do not have permission to do that");
  return doc;
}

export function getDocument(docId: string, userId: string) {
  return authorize(docId, userId, "view");
}

export async function listDocuments(userId: string) {
  const db = await getDb();
  const summary = { id: documents.id, title: documents.title, updatedAt: documents.updatedAt };
  const [owned, shared] = await Promise.all([
    db.select(summary).from(documents).where(eq(documents.ownerId, userId)).orderBy(desc(documents.updatedAt)),
    db
      .select({ ...summary, role: documentShares.role, ownerName: users.name })
      .from(documentShares)
      .innerJoin(documents, eq(documents.id, documentShares.documentId))
      .innerJoin(users, eq(users.id, documents.ownerId))
      .where(eq(documentShares.userId, userId))
      .orderBy(desc(documents.updatedAt)),
  ]);
  return { owned, shared };
}

export async function createDocument(ownerId: string, title = "Untitled document", content: JSONContent = EMPTY_DOC) {
  const db = await getDb();
  const [doc] = await db.insert(documents).values({ ownerId, title, content }).returning({ id: documents.id });
  return doc;
}

export async function renameDocument(docId: string, userId: string, title: string) {
  await authorize(docId, userId, "rename");
  const db = await getDb();
  await db.update(documents).set({ title, updatedAt: new Date() }).where(eq(documents.id, docId));
}

// Optimistic concurrency: the write only lands if nobody saved since the client's baseVersion.
export async function saveContent(docId: string, userId: string, content: JSONContent, baseVersion: number) {
  await authorize(docId, userId, "edit");
  const db = await getDb();
  const [saved] = await db
    .update(documents)
    .set({ content, version: sql`${documents.version} + 1`, updatedAt: new Date() })
    .where(and(eq(documents.id, docId), eq(documents.version, baseVersion)))
    .returning({ version: documents.version, updatedAt: documents.updatedAt });
  if (!saved) {
    await authorize(docId, userId, "edit");
    throw new HttpError(409, "Someone else saved a newer version of this document");
  }
  return saved;
}

export async function deleteDocument(docId: string, userId: string) {
  await authorize(docId, userId, "delete");
  const db = await getDb();
  await db.delete(documents).where(eq(documents.id, docId));
}

export async function listShares(docId: string, userId: string) {
  await authorize(docId, userId, "share");
  const db = await getDb();
  return db
    .select({ userId: users.id, name: users.name, email: users.email, role: documentShares.role })
    .from(documentShares)
    .innerJoin(users, eq(users.id, documentShares.userId))
    .where(eq(documentShares.documentId, docId))
    .orderBy(users.name);
}

export async function shareDocument(docId: string, ownerId: string, targetUserId: string, role: ShareRole) {
  const doc = await authorize(docId, ownerId, "share");
  if (targetUserId === doc.ownerId) throw new HttpError(400, "The owner already has full access");
  const db = await getDb();
  const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, targetUserId));
  if (!target) throw new HttpError(404, "User not found");
  await db
    .insert(documentShares)
    .values({ documentId: docId, userId: targetUserId, role })
    .onConflictDoUpdate({ target: [documentShares.documentId, documentShares.userId], set: { role } });
}

export async function revokeShare(docId: string, ownerId: string, targetUserId: string) {
  await authorize(docId, ownerId, "share");
  const db = await getDb();
  await db
    .delete(documentShares)
    .where(and(eq(documentShares.documentId, docId), eq(documentShares.userId, targetUserId)));
}

export async function listOtherUsers(userId: string) {
  const db = await getDb();
  return db.select().from(users).where(ne(users.id, userId)).orderBy(users.name);
}

import type { JSONContent } from "@tiptap/core";
import { index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const shareRole = pgEnum("share_role", ["viewer", "editor"]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
});

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: jsonb("content").$type<JSONContent>().notNull(),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("documents_owner_idx").on(t.ownerId)],
);

export const documentShares = pgTable(
  "document_shares",
  {
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: shareRole("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.documentId, t.userId] }), index("document_shares_user_idx").on(t.userId)],
);

export type User = typeof users.$inferSelect;
export type ShareRole = (typeof shareRole.enumValues)[number];

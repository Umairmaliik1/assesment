import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";
import * as documentRoute from "@/app/api/documents/[id]/route";
import * as shareRoute from "@/app/api/documents/[id]/shares/route";
import * as revokeRoute from "@/app/api/documents/[id]/shares/[userId]/route";
import * as importRoute from "@/app/api/documents/import/route";
import * as documentsRoute from "@/app/api/documents/route";
import * as sessionRoute from "@/app/api/session/route";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";

type Handler = (req: NextRequest, ctx: never) => Promise<Response>;
type User = "alice" | "bob" | "carol";

const tokens = {} as Record<User, string>;

async function call(handler: Handler, as: User | null, init: { body?: unknown; form?: FormData; params?: Record<string, string> } = {}) {
  const headers = new Headers();
  if (as) headers.set("cookie", `${SESSION_COOKIE}=${tokens[as]}`);
  let body: BodyInit | undefined = init.form;
  if (init.body !== undefined) {
    headers.set("content-type", "application/json");
    body = typeof init.body === "string" ? init.body : JSON.stringify(init.body);
  }
  const ctx = { params: Promise.resolve(init.params ?? {}) } as never;
  const res = await handler(new NextRequest("http://test/api", { method: "POST", headers, body }), ctx);
  return { status: res.status, headers: res.headers, json: res.status === 204 ? null : await res.json() };
}

const paragraph = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

async function createDoc(title = "Roadmap") {
  const { json } = await call(documentsRoute.POST, "alice", { body: { title } });
  return json.id as string;
}

beforeAll(async () => {
  for (const user of ["alice", "bob", "carol"] as User[]) tokens[user] = await createSessionToken(user);
});

describe("sessions", () => {
  it("sets an httpOnly cookie for a seeded user and rejects unknown users", async () => {
    const res = await call(sessionRoute.POST, null, { body: { userId: "bob" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/session=.+HttpOnly/i);
    expect((await call(sessionRoute.POST, null, { body: { userId: "mallory" } })).status).toBe(404);
  });

  it("requires a valid session for document APIs", async () => {
    expect((await call(documentsRoute.GET, null)).status).toBe(401);
    tokens.carol = "forged.token.value";
    expect((await call(documentsRoute.GET, "carol")).status).toBe(401);
    tokens.carol = await createSessionToken("carol");
  });
});

describe("sharing and access control", () => {
  it("separates owned and shared documents and enforces each role", async () => {
    const id = await createDoc();
    const params = { id };

    expect((await call(shareRoute.PUT, "alice", { params, body: { userId: "bob", role: "viewer" } })).status).toBe(200);

    const bobList = await call(documentsRoute.GET, "bob");
    expect(bobList.json.owned).toEqual([]);
    expect(bobList.json.shared).toMatchObject([{ id, role: "viewer", ownerName: "Alice Johnson" }]);
    expect((await call(documentsRoute.GET, "alice")).json.owned).toMatchObject([{ id }]);

    // Viewer can read but not write.
    expect((await call(documentRoute.GET, "bob", { params })).json.role).toBe("viewer");
    expect((await call(documentRoute.PATCH, "bob", { params, body: { content: paragraph("hi"), baseVersion: 1 } })).status).toBe(403);

    // Editor can write content but cannot rename, share or delete.
    await call(shareRoute.PUT, "alice", { params, body: { userId: "bob", role: "editor" } });
    expect((await call(documentRoute.PATCH, "bob", { params, body: { content: paragraph("hi"), baseVersion: 1 } })).status).toBe(200);
    expect((await call(documentRoute.PATCH, "bob", { params, body: { title: "Mine now" } })).status).toBe(403);
    expect((await call(shareRoute.PUT, "bob", { params, body: { userId: "carol", role: "editor" } })).status).toBe(403);
    expect((await call(documentRoute.DELETE, "bob", { params })).status).toBe(403);

    // A user with no access cannot tell the document exists.
    expect((await call(documentRoute.GET, "carol", { params })).status).toBe(404);

    // Revoking removes access entirely.
    expect((await call(revokeRoute.DELETE, "alice", { params: { id, userId: "bob" } })).status).toBe(204);
    expect((await call(documentRoute.GET, "bob", { params })).status).toBe(404);
    expect((await call(documentsRoute.GET, "bob")).json.shared).toEqual([]);
  });

  it("rejects sharing with the owner or an unknown user", async () => {
    const params = { id: await createDoc() };
    expect((await call(shareRoute.PUT, "alice", { params, body: { userId: "alice", role: "editor" } })).status).toBe(400);
    expect((await call(shareRoute.PUT, "alice", { params, body: { userId: "nobody", role: "editor" } })).status).toBe(404);
    expect((await call(shareRoute.PUT, "alice", { params, body: { userId: "bob", role: "admin" } })).status).toBe(400);
  });
});

describe("saving", () => {
  it("persists content and title, bumping the version only on content saves", async () => {
    const params = { id: await createDoc() };
    const saved = await call(documentRoute.PATCH, "alice", { params, body: { content: paragraph("v2"), baseVersion: 1 } });
    expect(saved.json.version).toBe(2);
    await call(documentRoute.PATCH, "alice", { params, body: { title: "  Renamed  " } });

    const { json } = await call(documentRoute.GET, "alice", { params });
    expect(json).toMatchObject({ title: "Renamed", version: 2, content: paragraph("v2") });
  });

  it("rejects a save based on a stale version with 409 and keeps the newer content", async () => {
    const params = { id: await createDoc() };
    await call(shareRoute.PUT, "alice", { params, body: { userId: "bob", role: "editor" } });
    expect((await call(documentRoute.PATCH, "bob", { params, body: { content: paragraph("bob"), baseVersion: 1 } })).status).toBe(200);

    const stale = await call(documentRoute.PATCH, "alice", { params, body: { content: paragraph("alice"), baseVersion: 1 } });
    expect(stale.status).toBe(409);
    expect((await call(documentRoute.GET, "alice", { params })).json.content).toEqual(paragraph("bob"));
  });

  it("validates input", async () => {
    const params = { id: await createDoc() };
    const patch = (body: unknown) => call(documentRoute.PATCH, "alice", { params, body });
    expect((await patch({ title: "   " })).json.error).toBe("Title cannot be empty");
    expect((await patch({ content: { type: "doc", content: [{ type: "script" }] }, baseVersion: 1 })).status).toBe(400);
    expect((await patch({ content: { type: "paragraph" }, baseVersion: 1 })).status).toBe(400);
    expect((await patch({ content: paragraph("x"), baseVersion: 0 })).status).toBe(400);
    expect((await patch("{not json")).json.error).toBe("Request body must be valid JSON");
    expect((await call(documentRoute.GET, "alice", { params: { id: "not-a-uuid" } })).status).toBe(404);
  });
});

describe("import", () => {
  it("creates an owned, editable document from an uploaded file", async () => {
    const form = new FormData();
    form.set("file", new File(["# Hello\n\nWorld"], "Hello.md"));
    const created = await call(importRoute.POST, "alice", { form });
    expect(created.status).toBe(201);

    const { json } = await call(documentRoute.GET, "alice", { params: { id: created.json.id } });
    expect(json).toMatchObject({ title: "Hello", role: "owner" });
    expect(json.content.content[0]).toMatchObject({ type: "heading", attrs: { level: 1 } });
  });

  it("returns a clear error when no file is sent", async () => {
    const res = await call(importRoute.POST, "alice", { form: new FormData() });
    expect(res).toMatchObject({ status: 400, json: { error: "Choose a file to import" } });
  });
});

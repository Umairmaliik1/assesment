import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  const db = await getDb();
  const accounts = await db.select().from(users).orderBy(users.name);
  return (
    <main className="mx-auto max-w-sm px-4 py-24">
      <h1 className="text-2xl font-semibold">Ajaia Docs</h1>
      <p className="mt-2 text-sm text-slate-600">Demo sign in: pick a seeded account. Sign in as different users to try sharing.</p>
      <LoginForm users={accounts} />
    </main>
  );
}

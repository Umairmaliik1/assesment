"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { User } from "@/db/schema";
import { api } from "@/lib/api-client";

export function LoginForm({ users }: { users: User[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(userId: string) {
    setPending(userId);
    setError(null);
    try {
      await api("/api/session", { method: "POST", json: { userId } });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setPending(null);
    }
  }

  return (
    <div className="mt-6 space-y-2">
      {users.map((user) => (
        <button
          key={user.id}
          onClick={() => signIn(user.id)}
          disabled={pending !== null}
          className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left hover:border-blue-400 hover:bg-blue-50 disabled:opacity-60"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-blue-100 font-medium text-blue-700">
            {user.name[0]}
          </span>
          <span>
            <span className="block font-medium">{user.name}</span>
            <span className="block text-sm text-slate-500">{pending === user.id ? "Signing in..." : user.email}</span>
          </span>
        </button>
      ))}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

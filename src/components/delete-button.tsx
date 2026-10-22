"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";

export function DeleteButton({ docId }: { docId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    try {
      await api(`/api/documents/${docId}`, { method: "DELETE" });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!confirming)
    return (
      <button onClick={() => setConfirming(true)} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
        Delete
      </button>
    );
  return (
    <span className="flex items-center gap-1 text-sm">
      <span className="text-slate-600">{error ?? "Delete for everyone?"}</span>
      <button onClick={remove} className="rounded-md bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-700">
        Delete
      </button>
      <button onClick={() => setConfirming(false)} className="rounded-md px-2 py-1 hover:bg-slate-100">
        Cancel
      </button>
    </span>
  );
}

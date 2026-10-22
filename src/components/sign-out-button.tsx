"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { flushPendingSaves, UNSAVED_CONFIRM } from "./pending-saves";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        if (!(await flushPendingSaves()) && !window.confirm(UNSAVED_CONFIRM)) return;
        await api("/api/session", { method: "DELETE" });
        router.replace("/login");
        router.refresh();
      }}
      className="text-sm text-slate-600 hover:text-slate-900"
    >
      Sign out
    </button>
  );
}

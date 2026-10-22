"use client";

import { useRef, useState } from "react";
import type { ShareRole, User } from "@/db/schema";
import { api } from "@/lib/api-client";

type Share = { userId: string; name: string; email: string; role: ShareRole };
type SharesResponse = { shares: Share[] };

export function ShareDialog({ docId }: { docId: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [users, setUsers] = useState<User[] | null>(null);
  const [shares, setShares] = useState<Share[]>([]);
  const [selected, setSelected] = useState("");
  const [role, setRole] = useState<ShareRole>("editor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function request(load: () => Promise<Share[]>) {
    setBusy(true);
    setError(null);
    try {
      setShares(await load());
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  function open() {
    dialog.current?.showModal();
    request(async () => {
      const [others, current] = await Promise.all([
        api<{ users: User[] }>("/api/users"),
        api<SharesResponse>(`/api/documents/${docId}/shares`),
      ]);
      setUsers(others.users);
      return current.shares;
    });
  }

  const grant = (userId: string, nextRole: ShareRole) =>
    request(async () => (await api<SharesResponse>(`/api/documents/${docId}/shares`, { method: "PUT", json: { userId, role: nextRole } })).shares);

  const revoke = (userId: string) =>
    request(async () => {
      await api(`/api/documents/${docId}/shares/${userId}`, { method: "DELETE" });
      return shares.filter((share) => share.userId !== userId);
    });

  const available = users?.filter((user) => !shares.some((share) => share.userId === user.id)) ?? [];

  return (
    <>
      <button onClick={open} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
        Share
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="share-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl p-0 shadow-xl backdrop:bg-slate-900/40"
      >
        <div className="p-5">
          <div className="flex items-center justify-between">
            <h2 id="share-title" className="text-lg font-semibold">Share document</h2>
            <button onClick={() => dialog.current?.close()} aria-label="Close" className="rounded px-2 text-xl text-slate-500 hover:bg-slate-100">
              ×
            </button>
          </div>

          <form
            className="mt-4 flex gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              if (selected && (await grant(selected, role))) setSelected("");
            }}
          >
            <select
              aria-label="Person"
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">{users === null ? "Loading..." : available.length ? "Add a person" : "Everyone has access"}</option>
              {available.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
            <RoleSelect value={role} onChange={setRole} />
            <button
              disabled={!selected || busy}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Share
            </button>
          </form>

          {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}

          <h3 className="mt-5 text-sm font-medium text-slate-500">People with access</h3>
          <ul className="mt-2 divide-y divide-slate-100">
            <li className="py-2 text-sm">
              You <span className="text-slate-500">(owner)</span>
            </li>
            {shares.map((share) => (
              <li key={share.userId} className="flex items-center gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {share.name} <span className="text-slate-500">{share.email}</span>
                </span>
                <RoleSelect value={share.role} onChange={(next) => grant(share.userId, next)} disabled={busy} />
                <button
                  onClick={() => revoke(share.userId)}
                  disabled={busy}
                  className="rounded px-2 py-1 text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </>
  );
}

function RoleSelect({ value, onChange, disabled }: { value: ShareRole; onChange: (role: ShareRole) => void; disabled?: boolean }) {
  return (
    <select
      aria-label="Access level"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as ShareRole)}
      className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
    >
      <option value="editor">Editor</option>
      <option value="viewer">Viewer</option>
    </select>
  );
}

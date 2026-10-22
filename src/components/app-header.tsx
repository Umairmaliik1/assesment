import Link from "next/link";
import type { User } from "@/db/schema";
import { SignOutButton } from "./sign-out-button";

export function AppHeader({ user, children }: { user: User; children?: React.ReactNode }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:h-14 sm:flex-nowrap sm:py-0">
        <Link href="/" className="font-semibold text-blue-700">
          Ajaia Docs
        </Link>
        <div className="order-last flex min-w-0 basis-full flex-wrap items-center gap-x-3 gap-y-2 sm:order-none sm:flex-1 sm:basis-auto sm:flex-nowrap">
          {children}
        </div>
        <div className="ml-auto flex items-center gap-4">
          <span className="hidden text-sm text-slate-600 sm:inline">{user.name}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}

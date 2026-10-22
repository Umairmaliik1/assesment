import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { DashboardActions } from "@/components/dashboard-actions";
import { getCurrentUser } from "@/lib/auth";
import { listDocuments } from "@/lib/documents";

const formatDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format;

type Row = { id: string; title: string; updatedAt: Date; ownerName?: string; role?: string };

function DocumentList({ title, empty, rows }: { title: string; empty: string; rows: Row[] }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
        {title} <span className="text-slate-400">({rows.length})</span>
      </h2>
      {rows.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {rows.map((doc) => (
            <li key={doc.id}>
              <Link href={`/documents/${doc.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50">
                <span className="min-w-0 flex-1 truncate font-medium">{doc.title}</span>
                {doc.ownerName && <span className="hidden text-sm text-slate-500 sm:inline">Owner: {doc.ownerName}</span>}
                {doc.role && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-700">{doc.role}</span>
                )}
                <span className="w-28 text-right text-sm text-slate-500">{formatDate(doc.updatedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { owned, shared } = await listDocuments(user.id);
  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold">Documents</h1>
          <DashboardActions />
        </div>
        <DocumentList title="My documents" empty="No documents yet. Create one or import a file." rows={owned} />
        <DocumentList title="Shared with me" empty="Nothing has been shared with you yet." rows={shared} />
      </main>
    </>
  );
}

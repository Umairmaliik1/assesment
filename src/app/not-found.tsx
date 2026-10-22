import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Document not found</h1>
      <p className="mt-2 text-slate-600">It may have been deleted, or it has not been shared with you.</p>
      <Link href="/" className="mt-6 inline-block text-blue-600 hover:underline">
        Back to documents
      </Link>
    </main>
  );
}

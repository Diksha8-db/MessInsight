import Link from 'next/link';

export default function Forbidden() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4 p-8">
        <h1 className="text-6xl font-bold text-red-500">403</h1>
        <h2 className="text-2xl font-semibold text-gray-800">Access Denied</h2>
        <p className="text-gray-600 max-w-sm">
          You do not have permission to view this page. Please contact an administrator if you
          believe this is a mistake.
        </p>
        <Link
          href="/"
          className="inline-block mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go Home
        </Link>
      </div>
    </main>
  );
}


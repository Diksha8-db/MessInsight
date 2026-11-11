import Link from 'next/link';

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/admin/users"
          className="block p-6 bg-white rounded-xl shadow hover:shadow-md transition-shadow"
        >
          <h2 className="text-lg font-semibold text-gray-800">User Management</h2>
          <p className="text-sm text-gray-500 mt-1">View, block, promote or remove users</p>
        </Link>
        <Link
          href="/admin/audit-logs"
          className="block p-6 bg-white rounded-xl shadow hover:shadow-md transition-shadow"
        >
          <h2 className="text-lg font-semibold text-gray-800">Audit Logs</h2>
          <p className="text-sm text-gray-500 mt-1">Track all admin actions</p>
        </Link>
      </div>
    </div>
  );
}


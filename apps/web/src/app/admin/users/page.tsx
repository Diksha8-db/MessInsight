'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'STUDENT' | 'MANAGER' | 'ADMIN';
  isVerified: boolean;
  isBlocked: boolean;
  messId?: string;
  createdAt: string;
}

interface PageData {
  users: User[];
  total: number;
  page: number;
  totalPages: number;
}

type Confirm = {
  type: 'block' | 'unblock' | 'remove' | 'assignManager' | 'removeManager' | 'resetPassword';
  user: User;
};

export default function AdminUsersPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [messIdInput, setMessIdInput] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search.trim()) params.set('search', search.trim());
      const res = await apiClient.get<PageData>(`/api/admin/users?${params}`);
      setData(res.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  async function runAction(url: string, method: 'PATCH' | 'POST' | 'DELETE', body?: object) {
    setActionMsg('');
    try {
      let res: { message?: string };
      if (method === 'PATCH') {
        res = await apiClient.patch(url, body);
      } else if (method === 'POST') {
        res = await apiClient.post(url, body);
      } else {
        res = await apiClient.delete(url);
      }
      setActionMsg(res.message || 'Done');
      setConfirm(null);
      setConfirmText('');
      setMessIdInput('');
      load();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : 'Action failed');
    }
  }

  const badge = (user: User) => {
    if (user.isBlocked) return <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs">Blocked</span>;
    if (!user.isVerified) return <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs">Unverified</span>;
    return <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">Active</span>;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">User Management</h1>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
        <input
          className="pl-9 pr-4 py-2 border rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {actionMsg && (
        <div className="p-3 bg-blue-50 text-blue-800 rounded-lg text-sm">{actionMsg}</div>
      )}

      {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      {/* Table */}
      {loading ? (
        <div className="text-gray-400 text-sm">Loading…</div>
      ) : data && data.users.length > 0 ? (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Name', 'Email', 'Role', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs">{u.role}</span>
                  </td>
                  <td className="px-4 py-3">{badge(u)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {u.isBlocked ? (
                        <button onClick={() => setConfirm({ type: 'unblock', user: u })} className="text-xs text-green-600 hover:underline">Unblock</button>
                      ) : (
                        <button onClick={() => setConfirm({ type: 'block', user: u })} className="text-xs text-orange-600 hover:underline">Block</button>
                      )}
                      {u.role !== 'MANAGER' && u.role !== 'ADMIN' && (
                        <button onClick={() => setConfirm({ type: 'assignManager', user: u })} className="text-xs text-blue-600 hover:underline">Make Manager</button>
                      )}
                      {u.role === 'MANAGER' && (
                        <button onClick={() => setConfirm({ type: 'removeManager', user: u })} className="text-xs text-purple-600 hover:underline">Remove Manager</button>
                      )}
                      <button onClick={() => setConfirm({ type: 'resetPassword', user: u })} className="text-xs text-gray-600 hover:underline">Reset Password</button>
                      {u.role !== 'ADMIN' && (
                        <button onClick={() => setConfirm({ type: 'remove', user: u })} className="text-xs text-red-600 hover:underline">Remove</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-600">
            <span>{data.total} user{data.total !== 1 ? 's' : ''}</span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="p-1 disabled:opacity-40"><ChevronLeft size={16} /></button>
              <span>Page {data.page} / {data.totalPages}</span>
              <button disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)} className="p-1 disabled:opacity-40"><ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-gray-400 text-sm py-8 text-center">No users found.</div>
      )}

      {/* Confirmation Modal */}
      {confirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {confirm.type === 'block' && 'Block User'}
              {confirm.type === 'unblock' && 'Unblock User'}
              {confirm.type === 'remove' && 'Remove Account'}
              {confirm.type === 'assignManager' && 'Assign as Manager'}
              {confirm.type === 'removeManager' && 'Remove Manager Role'}
              {confirm.type === 'resetPassword' && 'Reset Password'}
            </h2>
            <p className="text-sm text-gray-600">
              {confirm.type === 'remove'
                ? `Type the user's email "${confirm.user.email}" to confirm permanent removal.`
                : `Confirm action for ${confirm.user.name} (${confirm.user.email})?`}
            </p>

            {confirm.type === 'assignManager' && (
              <input
                className="border rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Mess ID"
                value={messIdInput}
                onChange={(e) => setMessIdInput(e.target.value)}
              />
            )}

            {confirm.type === 'remove' && (
              <input
                className="border rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder={`Type "${confirm.user.email}" to confirm`}
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
              />
            )}

            {actionMsg && <p className="text-sm text-red-600">{actionMsg}</p>}

            <div className="flex gap-3 justify-end">
              <button onClick={() => { setConfirm(null); setConfirmText(''); setMessIdInput(''); setActionMsg(''); }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button
                disabled={
                  (confirm.type === 'remove' && confirmText !== confirm.user.email) ||
                  (confirm.type === 'assignManager' && !messIdInput.trim())
                }
                onClick={() => {
                  const id = confirm.user.id;
                  if (confirm.type === 'block') runAction(`/api/admin/users/${id}/block`, 'PATCH');
                  else if (confirm.type === 'unblock') runAction(`/api/admin/users/${id}/unblock`, 'PATCH');
                  else if (confirm.type === 'remove') runAction(`/api/admin/users/${id}/remove`, 'DELETE');
                  else if (confirm.type === 'assignManager') runAction(`/api/admin/users/${id}/assign-manager`, 'PATCH', { messId: messIdInput });
                  else if (confirm.type === 'removeManager') runAction(`/api/admin/users/${id}/remove-manager`, 'PATCH');
                  else if (confirm.type === 'resetPassword') runAction(`/api/admin/users/${id}/reset-password`, 'POST');
                }}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


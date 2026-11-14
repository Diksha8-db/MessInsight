'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Search, ChevronLeft, ChevronRight, UserCog, ShieldOff, Trash2, KeyRound, UserX, UserCheck, Info, UserPlus, Loader2, CheckCircle2 } from 'lucide-react';

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

type ConfirmType = 'block' | 'unblock' | 'remove' | 'assignManager' | 'removeManager' | 'resetPassword';
type Confirm = { type: ConfirmType; user: User };

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-700',
  MANAGER: 'bg-amber-100 text-amber-700',
  STUDENT: 'bg-blue-100 text-blue-700',
};

export default function AdminUsersPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [messName, setMessName] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [actionOk, setActionOk] = useState(false);

  // New Manager modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createMessName, setCreateMessName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search.trim()) params.set('search', search.trim());
      const res = await apiClient.get<PageData>(`/api/admin/users?${params}`);
      setData(res.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  function openConfirm(type: ConfirmType, user: User) {
    setConfirm({ type, user });
    setConfirmText(''); setMessName(''); setActionMsg(''); setActionOk(false);
  }

  async function runAction(url: string, method: 'PATCH' | 'POST' | 'DELETE', body?: object) {
    setActionMsg(''); setActionOk(false);
    try {
      let res: { message?: string };
      if (method === 'PATCH') res = await apiClient.patch(url, body);
      else if (method === 'POST') res = await apiClient.post(url, body);
      else res = await apiClient.delete(url);
      setActionMsg(res.message || 'Done'); setActionOk(true);
      load();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : 'Action failed');
    }
  }

  async function handleCreateManager(e: React.FormEvent) {
    e.preventDefault();
    setCreateError('');
    setCreateSuccess('');
    setCreating(true);

    try {
      const res = await apiClient.post<{ message?: string }>('/api/admin/users', {
        name: createName,
        email: createEmail,
        password: createPassword,
        messName: createMessName,
      });

      setCreateSuccess(res.message || 'Manager created successfully!');
      setTimeout(() => {
        setShowCreateModal(false);
        setCreateName('');
        setCreateEmail('');
        setCreatePassword('');
        setCreateMessName('');
        setCreateSuccess('');
      }, 1200);
      load();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setCreateError(e.message || 'Failed to create manager.');
    } finally {
      setCreating(false);
    }
  }

  const statusBadge = (u: User) => {
    if (u.isBlocked) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">Blocked</span>;
    if (!u.isVerified) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium">Unverified</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">Active</span>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
        <p className="text-sm text-slate-500 mt-0.5">Search users, promote to Manager, block, or remove accounts.</p>
      </div>

      {/* Info tip */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800">
        <Info size={14} className="shrink-0 mt-0.5" />
        <span>To make a user a Mess Manager: click <strong>Make Manager</strong>, enter a Mess Name (e.g. <em>Hostel A Mess</em>), then confirm. A new Mess ID is auto-generated.</span>
      </div>

      {/* Search & Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <button
          onClick={() => {
            setShowCreateModal(true);
            setCreateError('');
            setCreateSuccess('');
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
        >
          <UserPlus size={16} /> Add New Manager
        </button>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">{error}</div>}

      {/* Table */}
      {loading ? (
        <div className="text-slate-400 text-sm py-8 text-center">Loading users…</div>
      ) : data && data.users.length > 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Name', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{u.name}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[u.role]}`}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3">{statusBadge(u)}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {u.role !== 'MANAGER' && u.role !== 'ADMIN' && (
                        <button onClick={() => openConfirm('assignManager', u)}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium transition-colors">
                          <UserCog size={12} /> Make Manager
                        </button>
                      )}
                      {u.role === 'MANAGER' && (
                        <button onClick={() => openConfirm('removeManager', u)}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium transition-colors">
                          <ShieldOff size={12} /> Remove Manager
                        </button>
                      )}
                      {u.isBlocked ? (
                        <button onClick={() => openConfirm('unblock', u)}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-medium transition-colors">
                          <UserCheck size={12} /> Unblock
                        </button>
                      ) : (
                        <button onClick={() => openConfirm('block', u)}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100 font-medium transition-colors">
                          <UserX size={12} /> Block
                        </button>
                      )}
                      <button onClick={() => openConfirm('resetPassword', u)}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 font-medium transition-colors">
                        <KeyRound size={12} /> Reset Pwd
                      </button>
                      {u.role !== 'ADMIN' && (
                        <button onClick={() => openConfirm('remove', u)}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-medium transition-colors">
                          <Trash2 size={12} /> Remove
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm text-slate-500 bg-slate-50">
            <span>{data.total} user{data.total !== 1 ? 's' : ''} total</span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-30 transition-colors"><ChevronLeft size={16} /></button>
              <span className="text-xs">Page {data.page} of {data.totalPages}</span>
              <button disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-30 transition-colors"><ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-slate-400 text-sm py-12 text-center bg-white rounded-2xl border border-slate-200">No users found.</div>
      )}

      {/* Create Manager Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <UserPlus size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Add New Mess Manager</h2>
                <p className="text-xs text-slate-500">Create a manager account directly with assigned mess</p>
              </div>
            </div>

            <form onSubmit={handleCreateManager} className="space-y-3 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1 block">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1 block">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="manager@example.com"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1 block">Password</label>
                <input
                  type="password"
                  required
                  placeholder="Min 8 characters (e.g. Password@123)"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1 block">
                  Mess / Canteen Name <span className="text-slate-400 font-normal lowercase">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Hostel A Mess"
                  value={createMessName}
                  onChange={(e) => setCreateMessName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {createError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs border border-red-100">
                  {createError}
                </div>
              )}

              {createSuccess && (
                <div className="p-3 bg-green-50 text-green-700 rounded-xl text-xs border border-green-100 flex items-center gap-1.5">
                  <CheckCircle2 size={16} />
                  <span>{createSuccess}</span>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm disabled:opacity-50 transition-colors"
                >
                  {creating ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                  {creating ? 'Creating…' : 'Create Manager'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal */}
      {confirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-800">
              {confirm.type === 'block' && '🚫 Block User'}
              {confirm.type === 'unblock' && '✅ Unblock User'}
              {confirm.type === 'remove' && '🗑️ Remove Account'}
              {confirm.type === 'assignManager' && '👔 Make Mess Manager'}
              {confirm.type === 'removeManager' && '↩️ Remove Manager Role'}
              {confirm.type === 'resetPassword' && '🔑 Reset Password'}
            </h2>

            <div className="p-3 bg-slate-50 rounded-xl text-sm text-slate-700 border border-slate-200">
              <span className="font-medium">{confirm.user.name}</span>
              <span className="text-slate-400 ml-2 text-xs">{confirm.user.email}</span>
            </div>

            {confirm.type === 'assignManager' && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Mess / Canteen Name</label>
                <input
                  className="border border-slate-200 rounded-xl px-3 py-2.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Hostel A Mess, Central Canteen…"
                  value={messName}
                  onChange={(e) => setMessName(e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-slate-400">A unique Mess ID is auto-generated from this name.</p>
              </div>
            )}

            {confirm.type === 'remove' && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-red-600 uppercase tracking-wide">Type email to confirm</label>
                <input
                  className="border border-red-200 rounded-xl px-3 py-2.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  placeholder={confirm.user.email}
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                />
              </div>
            )}

            {actionMsg && (
              <div className={`p-3 rounded-xl text-sm ${actionOk ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                {actionMsg}
              </div>
            )}

            <div className="flex gap-3 justify-end pt-1">
              <button
                onClick={() => { setConfirm(null); setActionMsg(''); }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                Cancel
              </button>
              <button
                disabled={
                  (confirm.type === 'remove' && confirmText !== confirm.user.email)
                }
                onClick={() => {
                  const id = confirm.user.id;
                  // For assignManager, generate a deterministic ObjectId-like string from the mess name
                  const autoMessId = confirm.type === 'assignManager'
                    ? Array.from(messName.trim().toLowerCase().replace(/\s+/g, ''))
                        .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                        .join('')
                        .padEnd(24, '0')
                        .slice(0, 24)
                    : '';

                  if (confirm.type === 'block') runAction(`/api/admin/users/${id}/block`, 'PATCH');
                  else if (confirm.type === 'unblock') runAction(`/api/admin/users/${id}/unblock`, 'PATCH');
                  else if (confirm.type === 'remove') runAction(`/api/admin/users/${id}/remove`, 'DELETE');
                  else if (confirm.type === 'assignManager') runAction(`/api/admin/users/${id}/assign-manager`, 'PATCH', {});
                  else if (confirm.type === 'removeManager') runAction(`/api/admin/users/${id}/remove-manager`, 'PATCH');
                  else if (confirm.type === 'resetPassword') runAction(`/api/admin/users/${id}/reset-password`, 'POST');
                }}
                className={`px-5 py-2 text-sm font-semibold rounded-xl text-white transition-colors disabled:opacity-40 ${
                  confirm.type === 'remove' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
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


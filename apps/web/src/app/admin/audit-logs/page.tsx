'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/apiClient';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface AuditLog {
  _id: string;
  actorId: string;
  action: string;
  targetCollection: string;
  summary: string;
  correlationId: string;
  createdAt: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get<{ logs: AuditLog[]; total: number }>(
        `/api/admin/audit-logs?page=${page}&limit=50`
      );
      setLogs(res.data.logs);
      setTotal(res.data.total);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>

      {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <div className="text-gray-400 text-sm">Loading…</div>
      ) : logs.length > 0 ? (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Time', 'Action', 'Actor', 'Collection', 'Summary'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <tr key={log._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-blue-700">{log.action}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{log.actorId}</td>
                  <td className="px-4 py-3 text-gray-500">{log.targetCollection}</td>
                  <td className="px-4 py-3 text-gray-700">{log.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-600">
            <span>{total} total logs</span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="p-1 disabled:opacity-40"><ChevronLeft size={16} /></button>
              <span>Page {page} / {totalPages || 1}</span>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="p-1 disabled:opacity-40"><ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-gray-400 text-sm py-8 text-center">No audit logs found.</div>
      )}
    </div>
  );
}


'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Shield, MessageSquare, AlertCircle, Utensils } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setStats(data.data);
        }
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <h1 className="text-xl font-bold text-slate-800">Institute Administration Portal</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          System-wide oversight, user accounts, security audit logging, and mess allocation
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium text-slate-500">Total Users</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <span className="text-2xl font-bold text-slate-800">
            {loading ? '...' : stats?.totalUsers ?? '—'}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {stats?.totalStudents ?? 0} students, {stats?.totalManagers ?? 0} managers
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium text-slate-500">Messes Active</span>
            <Utensils className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-2xl font-bold text-slate-800">
            {loading ? '...' : stats?.totalMesses ?? '—'}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">Campus canteens</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium text-slate-500">Student Reviews</span>
            <MessageSquare className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="text-2xl font-bold text-slate-800">
            {loading ? '...' : stats?.totalFeedbacks ?? '—'}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">All-time submissions</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium text-slate-500">Open Complaints</span>
            <AlertCircle className="w-4 h-4 text-red-500" />
          </div>
          <span className="text-2xl font-bold text-slate-800">
            {loading ? '...' : stats?.openComplaints ?? '—'}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">Require manager action</span>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/admin/users"
          className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">User Management</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                View student and manager accounts, assign mess scopes, or block/unblock users.
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/admin/audit-logs"
          className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Security Audit Logs</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Inspect immutable system audit records with actor IDs and correlation tracing.
              </p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

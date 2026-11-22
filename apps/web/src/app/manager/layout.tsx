'use client';

import Link from 'next/link';
import { LogOut } from 'lucide-react';

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors during logout
    } finally {
      window.location.href = '/login';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-6">
          <Link href="/manager" className="text-lg font-bold text-slate-800 tracking-tight">
            MessInsight <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium ml-1">Manager</span>
          </Link>
          <nav className="hidden md:flex items-center gap-4 text-sm font-medium text-slate-600">
            <Link href="/manager" className="hover:text-blue-600 transition-colors">
              Menu & Overview
            </Link>
            <Link href="/manager/complaints" className="hover:text-blue-600 transition-colors">
              Complaints
            </Link>
            <Link href="/manager/analytics" className="hover:text-blue-600 transition-colors">
              Analytics & AI
            </Link>
            <Link href="/manager/reports" className="hover:text-blue-600 transition-colors">
              Reports & Exports
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-red-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-red-200 transition-colors cursor-pointer"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </header>
      <main className="p-6 max-w-7xl mx-auto">{children}</main>
    </div>
  );
}


'use client';

import React, { useEffect, useState } from 'react';
import { FileText, Download, Plus, Calendar, AlertCircle } from 'lucide-react';

export default function ReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [type, setType] = useState('WEEKLY');
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/manager/reports');
      const data = await res.json();
      if (data.success) {
        setReports(data.data || []);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/manager/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, from, to }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'Report generation failed');
      }

      await loadReports();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <h1 className="text-xl font-bold text-slate-800">Mess Reports & Data Exports</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Generate comprehensive audits for food waste, ratings, and attendance with sanitised CSV exports.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Generation Form Card */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4 text-blue-600" />
          Generate New Report
        </h2>

        <form onSubmit={handleGenerate} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Report Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="DAILY">Daily Summary</option>
              <option value="WEEKLY">Weekly Performance</option>
              <option value="MONTHLY">Monthly Overview</option>
              <option value="WASTE">Food Waste Audit</option>
              <option value="ACCURACY">Prediction Accuracy</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">From Date</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              required
              className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">To Date</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              required
              className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={generating}
              className="w-full text-xs font-bold py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              {generating ? 'Compiling Report...' : 'Generate Report'}
            </button>
          </div>
        </form>
      </div>

      {/* Generated Reports Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Generated Reports Repository</h2>
          <span className="text-xs text-slate-400 font-mono">{reports.length} reports</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No reports generated yet. Use the form above to generate your first audit report.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Report Type</th>
                  <th className="px-5 py-3">Date Range</th>
                  <th className="px-5 py-3">Generated At</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((report) => (
                  <tr key={report._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-500" />
                        <span className="font-semibold text-slate-800">{report.type}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 font-mono">
                      {report.dateRange?.from} → {report.dateRange?.to}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400">
                      {new Date(report.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <a
                        href={`/api/manager/reports/${report._id}/export`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download CSV
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


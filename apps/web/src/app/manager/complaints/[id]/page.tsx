'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/apiClient';
import { ArrowLeft, Clock, CheckCircle2, XCircle, AlertCircle, Send, Check } from 'lucide-react';

interface ComplaintHistory {
  status: string;
  note: string;
  timestamp: string;
}

interface ComplaintDetail {
  _id: string;
  messId: string;
  category: string;
  priority: string;
  status: string;
  title: string;
  description: string;
  imageUrl?: string;
  managerResponse?: string;
  history: ComplaintHistory[];
  createdAt: string;
}

export default function ManagerComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [complaint, setComplaint] = useState<ComplaintDetail | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('IN_PROGRESS');
  const [managerResponse, setManagerResponse] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadComplaint = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await apiClient.get<ComplaintDetail>(`/api/manager/complaints/${id}`);
      if (res.data) {
        setComplaint(res.data);
        setSelectedStatus(res.data.status);
        setManagerResponse(res.data.managerResponse || '');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load complaint details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadComplaint();
  }, [id]);

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await apiClient.patch<ComplaintDetail>(
        `/api/manager/complaints/${id}/status`,
        {
          status: selectedStatus,
          managerResponse: managerResponse.trim() || undefined,
          note: note.trim() || undefined,
        }
      );

      if (res.data) {
        setComplaint(res.data);
        setSuccessMessage('Complaint status updated successfully!');
        setNote('');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update complaint status.');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 space-y-4">
        <div className="h-40 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-xl" />
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 text-center space-y-4">
        <p className="text-gray-500">Complaint not found.</p>
        <Link
          href="/manager/complaints"
          className="text-blue-600 hover:underline text-sm inline-flex items-center gap-1"
        >
          <ArrowLeft size={16} /> Back to complaints
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      <Link
        href="/manager/complaints"
        className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 inline-flex items-center gap-1.5 transition-colors"
      >
        <ArrowLeft size={16} /> Back to all complaints
      </Link>

      {errorMessage && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm flex items-center gap-2">
          <Check size={16} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Complaint Info Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-700 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              {complaint.category.replace('_', ' ')}
            </span>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded ${
                complaint.priority === 'URGENT'
                  ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
              }`}
            >
              Priority: {complaint.priority}
            </span>
          </div>
          <span className="text-xs text-gray-400">
            Filed: {new Date(complaint.createdAt).toLocaleString()}
          </span>
        </div>

        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {complaint.title}
          </h2>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 whitespace-pre-wrap leading-relaxed">
            {complaint.description}
          </p>
        </div>

        {complaint.imageUrl && (
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1">Attached Photo:</div>
            <img
              src={complaint.imageUrl}
              alt="Complaint evidence"
              className="w-48 h-48 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
            />
          </div>
        )}
      </div>

      {/* Action Form: Update Status & Response */}
      <form
        onSubmit={handleUpdateStatus}
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4 shadow-sm"
      >
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Update Resolution & Response
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
              Complaint Status *
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="OPEN">OPEN (Under review)</option>
              <option value="IN_PROGRESS">IN_PROGRESS (Investigating / Corrective action)</option>
              <option value="RESOLVED">RESOLVED (Issue addressed)</option>
              <option value="REJECTED">REJECTED (Invalid / Duplicate)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
              Internal Audit Note (Optional)
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Spoke to cook, sanitized water cooler"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
            Student-Facing Response *
          </label>
          <textarea
            value={managerResponse}
            onChange={(e) => setManagerResponse(e.target.value)}
            rows={3}
            placeholder="Explain to the student what corrective action was taken or resolution details..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>

        <button
          type="submit"
          disabled={isUpdating}
          className="py-2 px-5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 shadow-sm"
        >
          <Send size={14} />
          {isUpdating ? 'Saving...' : 'Update Status & Notify Student'}
        </button>
      </form>

      {/* History Timeline */}
      {complaint.history && complaint.history.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-3 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Activity & Resolution Timeline
          </h3>
          <div className="divide-y divide-gray-100 dark:divide-gray-700 text-xs">
            {complaint.history.map((h, idx) => (
              <div key={idx} className="py-2.5 flex items-start justify-between gap-3">
                <div>
                  <span className="font-semibold text-blue-600 dark:text-blue-400 mr-2">
                    {h.status}
                  </span>
                  {h.note && <span className="text-gray-600 dark:text-gray-300">{h.note}</span>}
                </div>
                <span className="text-gray-400 shrink-0">
                  {new Date(h.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


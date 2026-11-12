'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { ComplaintForm } from '@/components/feedback/ComplaintForm';
import { AlertTriangle, Clock, CheckCircle2, XCircle, PlusCircle, History } from 'lucide-react';

interface ComplaintItem {
  _id: string;
  category: string;
  priority: string;
  status: string;
  title: string;
  description: string;
  imageUrl?: string;
  managerResponse?: string;
  createdAt: string;
}

export default function StudentComplaintsPage() {
  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [activeTab, setActiveTab] = useState<'list' | 'new'>('list');
  const [messId, setMessId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const loadComplaints = async () => {
    setIsLoading(true);
    try {
      const [compRes, menuRes] = await Promise.all([
        apiClient.get<any>('/api/student/complaints'),
        apiClient.get<any>('/api/menu/today').catch(() => ({ data: [] })),
      ]);

      setComplaints(compRes.data?.complaints || []);
      if (menuRes.data && menuRes.data.length > 0) {
        setMessId(menuRes.data[0].messId);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadComplaints();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return (
          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            <Clock size={12} /> Open
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
            <Clock size={12} /> In Progress
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle2 size={12} /> Resolved
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
            <XCircle size={12} /> Rejected
          </span>
        );
      default:
        return <span className="text-xs">{status}</span>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-700 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <AlertTriangle className="text-red-500" />
            Mess Complaints
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Report issues regarding food quality, hygiene, or mess facilities.
          </p>
        </div>

        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'list'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <History size={14} /> My Complaints ({complaints.length})
          </button>
          <button
            onClick={() => setActiveTab('new')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'new'
                ? 'bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <PlusCircle size={14} /> File New Complaint
          </button>
        </div>
      </div>

      {activeTab === 'new' ? (
        <ComplaintForm
          messId={messId}
          onSuccess={() => {
            setActiveTab('list');
            loadComplaints();
          }}
        />
      ) : isLoading ? (
        <div className="space-y-4">
          <div className="h-28 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-xl" />
          <div className="h-28 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-xl" />
        </div>
      ) : complaints.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-8 space-y-3">
          <CheckCircle2 className="mx-auto text-emerald-500" size={36} />
          <h3 className="font-semibold text-gray-700 dark:text-gray-200">No Complaints Filed</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            You have not submitted any complaints. If you encounter any food hygiene or service issues, click &quot;File New Complaint&quot;.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {complaints.map((c) => (
            <div
              key={c._id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-700 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    {c.category.replace('_', ' ')}
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${
                      c.priority === 'URGENT'
                        ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                        : c.priority === 'HIGH'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800'
                    }`}
                  >
                    {c.priority}
                  </span>
                </div>
                {getStatusBadge(c.status)}
              </div>

              <div>
                <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {c.title}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap">
                  {c.description}
                </p>
              </div>

              {c.imageUrl && (
                <div>
                  <img
                    src={c.imageUrl}
                    alt="Complaint attachment"
                    className="w-32 h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                  />
                </div>
              )}

              {c.managerResponse && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-100 dark:border-blue-900 text-sm">
                  <div className="font-semibold text-blue-900 dark:text-blue-200 text-xs mb-1">
                    Manager Response:
                  </div>
                  <p className="text-blue-800 dark:text-blue-300 whitespace-pre-wrap">
                    {c.managerResponse}
                  </p>
                </div>
              )}

              <div className="text-[11px] text-gray-400 pt-1">
                Filed on: {new Date(c.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


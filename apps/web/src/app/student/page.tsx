'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/apiClient';
import { Utensils, MessageSquare, AlertTriangle, ArrowRight, Star, Clock } from 'lucide-react';

export default function StudentDashboard() {
  const [todayMenus, setTodayMenus] = useState<any[]>([]);
  const [recentFeedback, setRecentFeedback] = useState<any[]>([]);
  const [recentComplaints, setRecentComplaints] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [menuRes, fbRes, compRes] = await Promise.all([
          apiClient.get<any[]>('/api/menu/today').catch(() => ({ data: [] })),
          apiClient.get<any>('/api/student/feedback?limit=3').catch(() => ({ data: { feedback: [] } })),
          apiClient.get<any>('/api/student/complaints?limit=3').catch(() => ({ data: { complaints: [] } })),
        ]);

        setTodayMenus(menuRes.data || []);
        setRecentFeedback(fbRes.data?.feedback || []);
        setRecentComplaints(compRes.data?.complaints || []);
      } catch {
        // Ignore
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Student Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Welcome back! Here is today&apos;s mess menu and your recent activity.
        </p>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/student/feedback"
          className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-500 hover:shadow-md transition-all group"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center mb-3">
            <MessageSquare size={20} />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600">
            Submit Feedback
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Rate breakfast, lunch, snacks, or dinner dishes.
          </p>
        </Link>

        <Link
          href="/student/complaints"
          className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-red-500 hover:shadow-md transition-all group"
        >
          <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-950/60 text-red-600 flex items-center justify-center mb-3">
            <AlertTriangle size={20} />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-red-600">
            Report Grievance
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            File issues regarding food hygiene or dining facilities.
          </p>
        </Link>

        <Link
          href="/student/feedback"
          className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-emerald-500 hover:shadow-md transition-all group"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mb-3">
            <Utensils size={20} />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-emerald-600">
            View Today&apos;s Menu
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Check today&apos;s meals, timings, and dish availability.
          </p>
        </Link>
      </div>

      {/* Today's Meals Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Utensils size={18} className="text-blue-600" />
            Today&apos;s Menu
          </h2>
          <Link
            href="/student/feedback"
            className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium"
          >
            Feedback Form <ArrowRight size={12} />
          </Link>
        </div>

        {isLoading ? (
          <div className="h-24 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg" />
        ) : todayMenus.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">
            No published menu for today yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {todayMenus.map((m) => (
              <div
                key={m.id}
                className="p-4 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                    {m.mealType}
                  </span>
                  <Link
                    href="/student/feedback"
                    className="text-xs text-blue-600 hover:underline font-medium"
                  >
                    Rate
                  </Link>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {m.dishes?.map((d: any, idx: number) => (
                    <span
                      key={idx}
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        d.isAvailable
                          ? 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700'
                          : 'bg-red-50 text-red-600 border border-red-200 line-through'
                      }`}
                    >
                      {d.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Feedback */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
              <Star size={16} className="text-amber-500" />
              Your Recent Feedback
            </h2>
            <Link href="/student/feedback" className="text-xs text-blue-600 hover:underline">
              View all
            </Link>
          </div>

          {recentFeedback.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No feedback submitted yet.</p>
          ) : (
            <div className="space-y-3">
              {recentFeedback.map((fb) => (
                <div
                  key={fb._id}
                  className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-xs flex items-center justify-between border border-gray-100 dark:border-gray-700"
                >
                  <div>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                      {fb.mealType}
                    </span>
                    <span className="text-gray-400 ml-2">{fb.serviceDate}</span>
                  </div>
                  <div className="flex items-center gap-1 text-amber-500 font-bold">
                    <Star size={12} className="fill-amber-400" />
                    <span>{fb.overallRating}/5</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Complaints */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
              <Clock size={16} className="text-red-500" />
              Your Complaints
            </h2>
            <Link href="/student/complaints" className="text-xs text-blue-600 hover:underline">
              View all
            </Link>
          </div>

          {recentComplaints.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No active complaints.</p>
          ) : (
            <div className="space-y-3">
              {recentComplaints.map((c) => (
                <div
                  key={c._id}
                  className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-xs flex items-center justify-between border border-gray-100 dark:border-gray-700"
                >
                  <span className="font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[200px]">
                    {c.title}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      c.status === 'RESOLVED'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

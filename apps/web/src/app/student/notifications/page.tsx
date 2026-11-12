'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Bell, Check, Clock, AlertCircle } from 'lucide-react';

interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export default function StudentNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<any>('/api/student/notifications?limit=50');
      setNotifications(res.data?.notifications || []);
      setUnreadCount(res.data?.unreadCount || 0);
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const markSingleRead = async (id: string) => {
    try {
      await apiClient.patch(`/api/student/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Ignore
    }
  };

  const markAllRead = async () => {
    try {
      await apiClient.post('/api/student/notifications', {});
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Ignore
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Bell className="text-blue-600" />
            Notifications
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Menu updates, feedback confirmations, and complaint resolution alerts.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors"
          >
            <Check size={14} /> Mark all as read
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <div className="h-20 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-xl" />
          <div className="h-20 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-xl" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-8 space-y-2">
          <Bell className="mx-auto text-gray-400" size={32} />
          <p className="text-sm text-gray-500">No notifications to display.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n._id}
              onClick={() => !n.isRead && markSingleRead(n._id)}
              className={`p-4 rounded-xl border transition-colors cursor-pointer ${
                n.isRead
                  ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-80'
                  : 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                    )}
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {n.title}
                    </h4>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                    {n.message}
                  </p>
                </div>
                <span className="text-[11px] text-gray-400 shrink-0 flex items-center gap-1">
                  <Clock size={11} />
                  {new Date(n.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { FeedbackForm } from '@/components/feedback/FeedbackForm';
import { FeedbackCard } from '@/components/feedback/FeedbackCard';
import { Utensils, MessageSquare, AlertCircle, History } from 'lucide-react';

interface MenuDish {
  dishId: string;
  name: string;
  category: string;
  isAvailable: boolean;
}

interface MenuItem {
  id: string;
  messId: string;
  serviceDate: string;
  mealType: string;
  dishes: MenuDish[];
  status: string;
}

export default function StudentFeedbackPage() {
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');
  const [todayMenus, setTodayMenus] = useState<MenuItem[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [menuRes, histRes] = await Promise.all([
        apiClient.get<MenuItem[]>('/api/menu/today').catch(() => ({ data: [] })),
        apiClient.get<any>('/api/student/feedback?limit=10').catch(() => ({ data: { feedback: [] } })),
      ]);

      setTodayMenus(menuRes.data || []);
      setHistory(histRes.data?.feedback || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load menu or feedback.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteFeedback = async (id: string) => {
    if (!confirm('Are you sure you want to delete this feedback?')) return;
    try {
      await apiClient.delete(`/api/student/feedback/${id}`);
      setHistory((prev) => prev.filter((f) => f._id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete feedback');
    }
  };

  // Find if a menu already has feedback
  const getFeedbackForMenu = (menuId: string) => {
    return history.find((f) => f.menuId?.toString() === menuId || f.menuId === menuId);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-700 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Utensils className="text-blue-600" />
            Meal Feedback
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Rate your meals, give feedback on dishes, and help improve food quality.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('today')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'today'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <MessageSquare size={14} />
            Today&apos;s Meals
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <History size={14} />
            My Feedback History
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-40 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-xl" />
          <div className="h-40 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-xl" />
        </div>
      ) : activeTab === 'today' ? (
        <div className="space-y-6">
          {todayMenus.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-8 space-y-3">
              <Utensils className="mx-auto text-gray-400" size={36} />
              <h3 className="font-semibold text-gray-700 dark:text-gray-200">
                No Published Meals for Today
              </h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">
                The mess manager has not published today&apos;s menu yet. Please check back later.
              </p>
            </div>
          ) : (
            todayMenus.map((menu) => {
              const existingFeedback = getFeedbackForMenu(menu.id);
              return (
                <div key={menu.id} className="space-y-2">
                  {existingFeedback ? (
                    <div>
                      <div className="text-xs font-semibold uppercase text-emerald-600 mb-1 flex items-center gap-1">
                        Feedback Submitted for {menu.mealType}
                      </div>
                      <FeedbackCard
                        feedback={existingFeedback}
                        canEdit={true}
                        onDelete={handleDeleteFeedback}
                      />
                    </div>
                  ) : (
                    <FeedbackForm
                      menuId={menu.id}
                      messId={menu.messId}
                      mealType={menu.mealType}
                      serviceDate={menu.serviceDate}
                      dishes={menu.dishes}
                      onSuccess={loadData}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {history.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
              <History className="mx-auto text-gray-400 mb-2" size={32} />
              <p className="text-sm text-gray-500">You haven&apos;t submitted any feedback yet.</p>
            </div>
          ) : (
            history.map((fb) => (
              <FeedbackCard
                key={fb._id}
                feedback={fb}
                canEdit={true}
                onDelete={handleDeleteFeedback}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}


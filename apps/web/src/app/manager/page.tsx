'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import {
  Utensils, Plus, Trash2, CheckCircle2, ChevronDown, ChevronUp,
  AlertCircle, Loader2, Calendar, BarChart2, MessageSquare
} from 'lucide-react';
import Link from 'next/link';

interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  messId?: string;
}

type MealType = 'BREAKFAST' | 'LUNCH' | 'SNACKS' | 'DINNER';

const MEAL_TYPES: MealType[] = ['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER'];
const MEAL_ICONS: Record<MealType, string> = {
  BREAKFAST: '🌅',
  LUNCH: '☀️',
  SNACKS: '🫖',
  DINNER: '🌙',
};

interface DishEntry {
  name: string;
  category: string;
}

const DISH_CATEGORIES = ['MAIN_COURSE', 'BREAD', 'SIDE_DISH', 'DESSERT', 'BEVERAGE', 'SOUP', 'SALAD'];

export default function ManagerDashboard() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mealType, setMealType] = useState<MealType>('LUNCH');
  const [dishes, setDishes] = useState<DishEntry[]>([{ name: '', category: 'MAIN_COURSE' }]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [openSection, setOpenSection] = useState<'menu' | null>('menu');
  const [stats, setStats] = useState<{ openComplaints?: number; totalFeedbacks?: number } | null>(null);

  useEffect(() => {
    apiClient.get<SessionUser>('/api/auth/me')
      .then(r => setUser(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user?.messId) return;
    fetch(`/api/manager/complaints?messId=${user.messId}&page=1&limit=1`)
      .then(r => r.json())
      .then(d => { if (d.success) setStats(s => ({ ...s, openComplaints: d.meta?.total ?? 0 })); })
      .catch(() => {});
    fetch(`/api/manager/feedback?messId=${user.messId}&page=1&limit=1`)
      .then(r => r.json())
      .then(d => { if (d.success) setStats(s => ({ ...s, totalFeedbacks: d.meta?.total ?? 0 })); })
      .catch(() => {});
  }, [user]);

  function addDish() {
    setDishes(d => [...d, { name: '', category: 'MAIN_COURSE' }]);
  }

  function removeDish(i: number) {
    setDishes(d => d.filter((_, idx) => idx !== i));
  }

  function updateDish(i: number, field: keyof DishEntry, val: string) {
    setDishes(d => d.map((dish, idx) => idx === i ? { ...dish, [field]: val } : dish));
  }

  async function publishMenu(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.messId) return;
    const validDishes = dishes.filter(d => d.name.trim());
    if (validDishes.length === 0) {
      setResult({ ok: false, msg: 'Add at least one dish.' });
      return;
    }

    setSubmitting(true);
    setResult(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const menuRes = await apiClient.post<{ id: string }>('/api/manager/menu', {
        messId: user.messId,
        serviceDate: today,
        mealType,
        dishes: validDishes.map(d => ({
          name: d.name.trim(),
          category: d.category,
          isAvailable: true,
        })),
      });

      if (menuRes.data?.id) {
        await apiClient.post('/api/manager/menu/publish', {
          messId: user.messId,
          menuId: menuRes.data.id,
          version: 1,
        });
      }

      setResult({ ok: true, msg: `${mealType.charAt(0) + mealType.slice(1).toLowerCase()} menu published! Students can now see today's menu.` });
      setDishes([{ name: '', category: 'MAIN_COURSE' }]);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setResult({ ok: false, msg: e.message || 'Failed to publish menu. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-500" size={28} />
      </div>
    );
  }

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              Welcome, {user?.name?.split(' ')[0]} 👋
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
              <Calendar size={12} className="inline" /> {today}
            </p>
          </div>
          {user?.messId && (
            <div className="text-right">
              <div className="text-xs text-slate-400">Your Mess ID</div>
              <div className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded mt-0.5">
                {user.messId.slice(0, 10)}…
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Link href="/manager/complaints"
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-red-200 hover:shadow-md transition-all group cursor-pointer">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Open Complaints</span>
            <AlertCircle size={16} className="text-red-400" />
          </div>
          <div className="text-2xl font-bold text-slate-800">{stats?.openComplaints ?? '—'}</div>
          <div className="text-xs text-slate-400 mt-0.5">Tap to review →</div>
        </Link>

        <Link href="/manager/analytics"
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-blue-200 hover:shadow-md transition-all group cursor-pointer">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Student Feedback</span>
            <MessageSquare size={16} className="text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-slate-800">{stats?.totalFeedbacks ?? '—'}</div>
          <div className="text-xs text-slate-400 mt-0.5">View analytics →</div>
        </Link>

        <Link href="/manager/analytics"
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-emerald-200 hover:shadow-md transition-all group cursor-pointer col-span-2 md:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">AI Predictions</span>
            <BarChart2 size={16} className="text-emerald-400" />
          </div>
          <div className="text-sm font-semibold text-slate-700">Demand Forecast</div>
          <div className="text-xs text-slate-400 mt-0.5">View ML insights →</div>
        </Link>
      </div>

      {/* Today's Menu Publisher */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <button
          onClick={() => setOpenSection(openSection === 'menu' ? null : 'menu')}
          className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Utensils size={18} />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-800">Publish Today&apos;s Menu</div>
              <div className="text-xs text-slate-500">Add dishes and publish for students to see</div>
            </div>
          </div>
          {openSection === 'menu'
            ? <ChevronUp size={18} className="text-slate-400 shrink-0" />
            : <ChevronDown size={18} className="text-slate-400 shrink-0" />}
        </button>

        {openSection === 'menu' && (
          <div className="border-t border-slate-100 p-5">
            {!user?.messId ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>No Mess ID is assigned to your account. Contact an Admin to assign you to a mess.</span>
              </div>
            ) : (
              <form onSubmit={publishMenu} className="space-y-5">
                {/* Meal Type */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 block">
                    Meal Type
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {MEAL_TYPES.map(mt => (
                      <button
                        key={mt}
                        type="button"
                        onClick={() => setMealType(mt)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                          mealType === mt
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50'
                        }`}
                      >
                        {MEAL_ICONS[mt]} {mt.charAt(0) + mt.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dishes */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 block">
                    Dishes &nbsp;<span className="text-slate-400 font-normal normal-case">({dishes.filter(d => d.name.trim()).length} items)</span>
                  </label>
                  <div className="space-y-2">
                    {dishes.map((dish, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={dish.name}
                          onChange={e => updateDish(i, 'name', e.target.value)}
                          placeholder={`Dish ${i + 1} name…`}
                          className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                        <select
                          value={dish.category}
                          onChange={e => updateDish(i, 'category', e.target.value)}
                          className="border border-slate-200 rounded-xl px-2 py-2 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                        >
                          {DISH_CATEGORIES.map(c => (
                            <option key={c} value={c}>{c.replace('_', ' ')}</option>
                          ))}
                        </select>
                        {dishes.length > 1 && (
                          <button type="button" onClick={() => removeDish(i)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={addDish}
                    className="mt-2 flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 font-medium px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors">
                    <Plus size={15} /> Add another dish
                  </button>
                </div>

                {result && (
                  <div className={`flex items-start gap-2 p-3 rounded-xl text-sm border ${
                    result.ok
                      ? 'bg-green-50 text-green-700 border-green-100'
                      : 'bg-red-50 text-red-700 border-red-100'
                  }`}>
                    {result.ok
                      ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                      : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
                    {result.msg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                >
                  {submitting
                    ? <><Loader2 size={15} className="animate-spin" /> Publishing…</>
                    : <><CheckCircle2 size={15} /> Publish {mealType.charAt(0) + mealType.slice(1).toLowerCase()} Menu for Today</>}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { href: '/manager/complaints', label: 'Manage Complaints', desc: 'Review and resolve student grievances', emoji: '📋' },
          { href: '/manager/analytics', label: 'Analytics & AI', desc: 'Sentiment trends, attendance forecasts', emoji: '📊' },
          { href: '/manager/reports', label: 'Reports & Exports', desc: 'Download weekly data and waste logs', emoji: '📁' },
        ].map(item => (
          <Link key={item.href} href={item.href}
            className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-slate-300 transition-all">
            <div className="text-2xl mb-2">{item.emoji}</div>
            <div className="text-sm font-bold text-slate-800">{item.label}</div>
            <div className="text-xs text-slate-500 mt-0.5">{item.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

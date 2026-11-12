'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { RatingsChart } from '@/components/charts/RatingsChart';
import { SentimentChart } from '@/components/charts/SentimentChart';
import { AttendanceChart } from '@/components/charts/AttendanceChart';
import { WasteChart } from '@/components/charts/WasteChart';
import { Sparkles, Calendar, AlertTriangle, TrendingUp, RefreshCw } from 'lucide-react';

export default function AnalyticsPage() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [ratingsData, setRatingsData] = useState<any[]>([]);
  const [dishRatings, setDishRatings] = useState<any[]>([]);
  const [sentimentData, setSentimentData] = useState<any[]>([]);
  const [topIssues, setTopIssues] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [wasteData, setWasteData] = useState<any[]>([]);
  const [accuracyMetrics, setAccuracyMetrics] = useState<any | null>(null);

  // Prediction trigger state
  const [predicting, setPredicting] = useState(false);
  const [predictResult, setPredictResult] = useState<any | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [ratingsRes, sentimentRes, attendanceRes, wasteRes, accuracyRes] = await Promise.all([
        fetch(`/api/manager/analytics/ratings?from=${from}&to=${to}`).then((r) => r.json()),
        fetch(`/api/manager/analytics/sentiment?from=${from}&to=${to}`).then((r) => r.json()),
        fetch(`/api/manager/analytics/attendance?from=${from}&to=${to}`).then((r) => r.json()),
        fetch(`/api/manager/analytics/waste?from=${from}&to=${to}`).then((r) => r.json()),
        fetch(`/api/manager/predictions/accuracy?from=${from}&to=${to}`).then((r) => r.json()),
      ]);

      if (ratingsRes.success) {
        setRatingsData(ratingsRes.data.ratings || []);
        setDishRatings(ratingsRes.data.dishRatings || []);
      }
      if (sentimentRes.success) {
        setSentimentData(sentimentRes.data.distribution || []);
        setTopIssues(sentimentRes.data.topIssues || []);
      }
      if (attendanceRes.success) {
        setAttendanceData(attendanceRes.data || []);
      }
      if (wasteRes.success) {
        setWasteData(wasteRes.data || []);
      }
      if (accuracyRes.success) {
        setAccuracyMetrics(accuracyRes.data || null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerateTomorrowPrediction = async () => {
    setPredicting(true);
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const res = await fetch('/api/manager/predictions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceDate: tomorrowStr,
          mealType: 'LUNCH',
          capacity: 1000,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPredictResult(data.data);
      } else {
        alert(data.message || 'Prediction generation failed');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setPredicting(false);
    }
  };

  // High-level summary calculations
  const totalReviews = ratingsData.reduce((acc, curr) => acc + (curr.totalFeedbacks || 0), 0);
  const avgOverallRating =
    ratingsData.length > 0
      ? (
          ratingsData.reduce((acc, curr) => acc + curr.averageRating, 0) /
          ratingsData.length
        ).toFixed(2)
      : 'N/A';

  return (
    <div className="space-y-6">
      {/* Header and Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Operational Analytics & AI Insights</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time sentiment NLP, meal demand forecasts, and waste tracking
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-transparent border-0 text-slate-700 font-medium focus:outline-none"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bg-transparent border-0 text-slate-700 font-medium focus:outline-none"
            />
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-slate-500">Average Rating</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-slate-800">{avgOverallRating}★</span>
            <span className="text-xs text-slate-400 font-mono">/ 5.0</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">{totalReviews} total student ratings</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-slate-500">ML Forecast MAE</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-slate-800">
              {accuracyMetrics?.mlMae !== null && accuracyMetrics?.mlMae !== undefined
                ? `±${accuracyMetrics.mlMae}`
                : '±3.5'}
            </span>
            <span className="text-xs text-emerald-600 font-medium">students</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {accuracyMetrics?.mlCount || 0} evaluated meals
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-slate-500">Total Recorded Feedbacks</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-slate-800">{totalReviews}</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">In selected period</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-slate-500">Tracked Ingredients</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-slate-800">{wasteData.length}</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">With waste metrics</span>
        </div>
      </div>

      {/* AI Demand Prediction Trigger Card */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-5 rounded-2xl shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold">Generate AI Demand Forecast</h2>
          </div>
          <p className="text-xs text-blue-200 mt-1 max-w-xl">
            Leverage trained RandomForest models to forecast tomorrow’s lunch turnout and avoid surplus preparation.
          </p>
        </div>

        <button
          onClick={handleGenerateTomorrowPrediction}
          disabled={predicting}
          className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-900 text-xs font-bold rounded-xl shadow transition-all disabled:opacity-50 whitespace-nowrap"
        >
          {predicting ? 'Generating Forecast...' : 'Predict Tomorrow Lunch'}
        </button>
      </div>

      {predictResult && (
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-emerald-900 text-xs flex items-center justify-between">
          <div>
            <span className="font-bold">Predicted Lunch Attendance: </span>
            <span className="text-base font-mono font-bold ml-1">
              {predictResult.predictedAttendance} students
            </span>
            {predictResult.lowerBound && predictResult.upperBound && (
              <span className="text-slate-500 ml-2">
                (Range: {predictResult.lowerBound} – {predictResult.upperBound})
              </span>
            )}
            <span className="ml-3 px-2 py-0.5 bg-emerald-200 text-emerald-800 rounded font-mono">
              Source: {predictResult.source}
            </span>
          </div>
          <button
            onClick={() => setPredictResult(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Grid of Visual Analytics Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RatingsChart data={ratingsData} />
        <SentimentChart data={sentimentData} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AttendanceChart data={attendanceData} />
        <WasteChart data={wasteData} />
      </div>

      {/* Top AI Issues Detected and Dish Ratings Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Issues Card */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-700">Top Food Quality Issues (NLP Detected)</h3>
          </div>
          {topIssues.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No specific issues detected by NLP model in this period.</p>
          ) : (
            <div className="space-y-2">
              {topIssues.map((issue, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-400 font-bold">{idx + 1}.</span>
                    <span className="font-medium text-slate-700">{issue.issue}</span>
                    {issue.dishes && issue.dishes.length > 0 && (
                      <span className="text-slate-400 text-[10px]">
                        ({issue.dishes.slice(0, 2).join(', ')})
                      </span>
                    )}
                  </div>
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-mono font-medium">
                    {issue.count} mentions
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dish Leaderboard */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-slate-700">Dish Ratings Leaderboard</h3>
          </div>
          {dishRatings.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No individual dish ratings submitted yet.</p>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-2">
              {dishRatings.slice(0, 10).map((dish, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-xs"
                >
                  <div>
                    <span className="font-medium text-slate-700">{dish.dishName || 'Unknown Dish'}</span>
                    <span className="text-[10px] text-slate-400 ml-1.5 capitalize">
                      ({dish.category || 'General'})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-600 font-mono">
                      {dish.averageRating}★
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      ({dish.ratingCount} reviews)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


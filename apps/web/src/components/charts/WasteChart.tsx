'use client';

import React from 'react';

interface WasteItem {
  ingredient: string;
  unit: string;
  totalPrepared: number;
  totalConsumed: number;
  totalLeftover: number;
  wastePercentage: number | null;
}

interface WasteChartProps {
  data: WasteItem[];
}

export function WasteChart({ data }: WasteChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
        No waste records recorded for this period
      </div>
    );
  }

  const items = data.slice(0, 8); // Top 8 ingredients

  return (
    <div className="w-full bg-white p-4 rounded-xl shadow-sm border border-slate-200">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Ingredient Waste Percentages</h3>
      <div className="space-y-3">
        {items.map((item, i) => {
          const pct = item.wastePercentage ?? 0;
          const isHigh = pct > 20;
          const isMedium = pct > 10;
          const barColor = isHigh ? 'bg-red-500' : isMedium ? 'bg-amber-500' : 'bg-emerald-500';

          return (
            <div key={i} className="text-xs">
              <div className="flex justify-between items-center mb-1">
                <span className="font-medium text-slate-700 capitalize">{item.ingredient}</span>
                <span className="font-mono text-slate-500">
                  {pct.toFixed(1)}% ({item.totalLeftover} {item.unit} left)
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full ${barColor} rounded-full transition-all duration-500`}
                  style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


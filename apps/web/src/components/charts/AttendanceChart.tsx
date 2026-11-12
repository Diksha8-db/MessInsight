'use client';

import React from 'react';

interface AttendancePoint {
  serviceDate: string;
  mealType: string;
  actualAttendance: number;
}

interface AttendanceChartProps {
  data: AttendancePoint[];
}

const MEAL_COLORS: Record<string, string> = {
  BREAKFAST: '#38bdf8',
  LUNCH: '#f59e0b',
  SNACKS: '#a855f7',
  DINNER: '#3b82f6',
};

export function AttendanceChart({ data }: AttendanceChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
        No attendance data available
      </div>
    );
  }

  const width = 600;
  const height = 240;
  const padding = { top: 20, right: 30, bottom: 40, left: 45 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxVal = Math.max(...data.map((d) => d.actualAttendance), 100);
  const yTicks = [0, Math.round(maxVal / 2), maxVal];

  // Limit display to the most recent 24 records if many
  const displayData = data.slice(-24);
  const barWidth = Math.max(4, Math.min(20, (chartWidth / displayData.length) - 4));

  return (
    <div className="w-full bg-white p-4 rounded-xl shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">Actual Attendance Trend</h3>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          {Object.entries(MEAL_COLORS).map(([meal, color]) => (
            <div key={meal} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded" style={{ backgroundColor: color }} />
              <span>{meal[0] + meal.slice(1).toLowerCase()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto max-h-64 select-none">
          {/* Horizontal grid lines */}
          {yTicks.map((val, idx) => {
            const y = padding.top + chartHeight - (val / maxVal) * chartHeight;
            return (
              <g key={idx}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="text-[10px] fill-slate-400 font-mono"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {displayData.map((d, i) => {
            const barHeight = (d.actualAttendance / maxVal) * chartHeight;
            const x =
              padding.left +
              (i * chartWidth) / displayData.length +
              (chartWidth / displayData.length - barWidth) / 2;
            const y = padding.top + chartHeight - barHeight;
            const color = MEAL_COLORS[d.mealType] || '#3b82f6';

            return (
              <g key={i} className="group cursor-pointer">
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(2, barHeight)}
                  rx="3"
                  fill={color}
                  className="transition-all hover:opacity-80"
                />
                <title>{`${d.serviceDate} (${d.mealType}): ${d.actualAttendance} students`}</title>
              </g>
            );
          })}

          {/* X axis baseline */}
          <line
            x1={padding.left}
            y1={padding.top + chartHeight}
            x2={width - padding.right}
            y2={padding.top + chartHeight}
            stroke="#e2e8f0"
            strokeWidth="1"
          />
        </svg>
      </div>
    </div>
  );
}


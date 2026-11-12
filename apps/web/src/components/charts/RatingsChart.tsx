'use client';

import React from 'react';

interface RatingDataPoint {
  date: string;
  averageRating: number;
  totalFeedbacks: number;
}

interface RatingsChartProps {
  data: RatingDataPoint[];
}

export function RatingsChart({ data }: RatingsChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
        No rating data available for selected date range
      </div>
    );
  }

  const width = 600;
  const height = 240;
  const padding = { top: 20, right: 30, bottom: 40, left: 40 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const minRating = 1;
  const maxRating = 5;

  const points = data.map((d, index) => {
    const x =
      padding.left +
      (data.length > 1 ? (index / (data.length - 1)) * chartWidth : chartWidth / 2);
    const y =
      padding.top +
      chartHeight -
      ((d.averageRating - minRating) / (maxRating - minRating)) * chartHeight;
    return { ...d, x, y };
  });

  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  // Fill gradient path down to baseline
  const baselineY = padding.top + chartHeight;
  const areaD =
    points.length > 0
      ? `${pathD} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`
      : '';

  return (
    <div className="w-full bg-white p-4 rounded-xl shadow-sm border border-slate-200">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Average Rating Trend</h3>
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto max-h-64 select-none"
        >
          <defs>
            <linearGradient id="ratingGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[1, 2, 3, 4, 5].map((rating) => {
            const y =
              padding.top +
              chartHeight -
              ((rating - minRating) / (maxRating - minRating)) * chartHeight;
            return (
              <g key={rating}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="text-[10px] fill-slate-400 font-mono"
                >
                  {rating}★
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          {areaD && <path d={areaD} fill="url(#ratingGradient)" />}

          {/* Line stroke */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data Points */}
          {points.map((p, i) => (
            <g key={i} className="group cursor-pointer">
              <circle
                cx={p.x}
                cy={p.y}
                r="4.5"
                fill="#ffffff"
                stroke="#2563eb"
                strokeWidth="2"
                className="transition-transform group-hover:scale-125"
              />
              <title>{`${p.date}: ${p.averageRating}★ (${p.totalFeedbacks} reviews)`}</title>
            </g>
          ))}

          {/* X axis labels (sample every few if many) */}
          {points.map((p, i) => {
            const step = Math.ceil(points.length / 7);
            if (i % step !== 0 && i !== points.length - 1) return null;
            return (
              <text
                key={i}
                x={p.x}
                y={height - 12}
                textAnchor="middle"
                className="text-[9px] fill-slate-400 font-mono"
              >
                {p.date.slice(5)}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}


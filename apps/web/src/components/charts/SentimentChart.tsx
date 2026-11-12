'use client';

import React from 'react';

interface SentimentItem {
  label: string;
  count: number;
}

interface SentimentChartProps {
  data: SentimentItem[];
}

const COLOR_MAP: Record<string, { fill: string; text: string }> = {
  POSITIVE: { fill: '#10b981', text: 'Positive' },
  NEUTRAL: { fill: '#64748b', text: 'Neutral' },
  NEGATIVE: { fill: '#ef4444', text: 'Negative' },
  MIXED: { fill: '#f59e0b', text: 'Mixed' },
  UNCERTAIN: { fill: '#a855f7', text: 'Uncertain' },
  PENDING: { fill: '#cbd5e1', text: 'Pending' },
};

export function SentimentChart({ data }: SentimentChartProps) {
  const total = (data || []).reduce((acc, curr) => acc + curr.count, 0);

  if (!data || data.length === 0 || total === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
        No sentiment data available
      </div>
    );
  }

  // Calculate cumulative slice angles
  let cumulativeAngle = 0;
  const radius = 65;
  const innerRadius = 40;
  const cx = 100;
  const cy = 100;

  const slices = data
    .filter((d) => d.count > 0)
    .map((d) => {
      const percentage = d.count / total;
      const angle = percentage * 360;
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + angle;
      cumulativeAngle += angle;

      const startRad = ((startAngle - 90) * Math.PI) / 180;
      const endRad = ((endAngle - 90) * Math.PI) / 180;

      const x1 = cx + radius * Math.cos(startRad);
      const y1 = cy + radius * Math.sin(startRad);
      const x2 = cx + radius * Math.cos(endRad);
      const y2 = cy + radius * Math.sin(endRad);

      const ix1 = cx + innerRadius * Math.cos(startRad);
      const iy1 = cy + innerRadius * Math.sin(startRad);
      const ix2 = cx + innerRadius * Math.cos(endRad);
      const iy2 = cy + innerRadius * Math.sin(endRad);

      const largeArcFlag = angle > 180 ? 1 : 0;

      const pathData =
        angle >= 359.9
          ? `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 0 ${cx} ${cy + radius} A ${radius} ${radius} 0 1 0 ${cx} ${cy - radius} M ${cx} ${cy - innerRadius} A ${innerRadius} ${innerRadius} 0 1 1 ${cx} ${cy + innerRadius} A ${innerRadius} ${innerRadius} 0 1 1 ${cx} ${cy - innerRadius}`
          : `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${ix1} ${iy1} Z`;

      return {
        ...d,
        percentage: (percentage * 100).toFixed(1),
        pathData,
        color: COLOR_MAP[d.label]?.fill || '#94a3b8',
        name: COLOR_MAP[d.label]?.text || d.label,
      };
    });

  return (
    <div className="w-full bg-white p-4 rounded-xl shadow-sm border border-slate-200">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Sentiment Breakdown</h3>
      <div className="flex flex-col sm:flex-row items-center justify-around gap-4">
        {/* SVG Donut */}
        <div className="relative w-44 h-44">
          <svg viewBox="0 0 200 200" className="w-full h-full select-none">
            {slices.map((slice, i) => (
              <path
                key={i}
                d={slice.pathData}
                fill={slice.color}
                className="transition-opacity hover:opacity-85 cursor-pointer"
              >
                <title>{`${slice.name}: ${slice.count} (${slice.percentage}%)`}</title>
              </path>
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-lg font-bold text-slate-800">{total}</span>
            <span className="text-[10px] text-slate-400 font-medium">Reviews</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-2 min-w-36">
          {slices.map((slice, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="text-slate-600 font-medium">{slice.name}</span>
              </div>
              <span className="text-slate-400 font-mono">
                {slice.count} ({slice.percentage}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


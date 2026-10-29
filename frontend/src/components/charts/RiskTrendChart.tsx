import React from "react";
import { DailyRiskScore } from "@/types/domain";
import { formatDate } from "@/lib/formatting";

interface RiskTrendChartProps {
  data: DailyRiskScore[];
  height?: number;
}

export const RiskTrendChart: React.FC<RiskTrendChartProps> = ({
  data,
  height = 200,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
        No longitudinal score observations recorded.
      </div>
    );
  }

  // Sort chronologically
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));

  const padding = { top: 20, right: 20, bottom: 30, left: 35 };
  const width = 500;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxScore = 100;
  const minScore = 0;

  const getX = (index: number) => {
    if (sorted.length <= 1) return padding.left + chartWidth / 2;
    return padding.left + (index / (sorted.length - 1)) * chartWidth;
  };

  const getY = (score: number) => {
    return (
      padding.top +
      chartHeight -
      ((score - minScore) / (maxScore - minScore)) * chartHeight
    );
  };

  const points = sorted.map((d, i) => `${getX(i)},${getY(d.risk_score)}`).join(" ");

  // Threshold lines: 25 (Moderate), 50 (High), 75 (Urgent Review)
  const yUrgent = getY(75);
  const yHigh = getY(50);
  const yMod = getY(25);

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[420px]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full overflow-visible font-sans"
          aria-label="Longitudinal Risk Score Trendline"
        >
          {/* Threshold Bands Backgrounds */}
          <rect
            x={padding.left}
            y={padding.top}
            width={chartWidth}
            height={yUrgent - padding.top}
            fill="#fef2f2"
            opacity="0.6"
          />
          <rect
            x={padding.left}
            y={yUrgent}
            width={chartWidth}
            height={yHigh - yUrgent}
            fill="#fff7ed"
            opacity="0.6"
          />
          <rect
            x={padding.left}
            y={yHigh}
            width={chartWidth}
            height={yMod - yHigh}
            fill="#fffbeb"
            opacity="0.6"
          />
          <rect
            x={padding.left}
            y={yMod}
            width={chartWidth}
            height={padding.top + chartHeight - yMod}
            fill="#ecfdf5"
            opacity="0.6"
          />

          {/* Threshold reference lines */}
          <line
            x1={padding.left}
            y1={yUrgent}
            x2={width - padding.right}
            y2={yUrgent}
            stroke="#fca5a5"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
          <line
            x1={padding.left}
            y1={yHigh}
            x2={width - padding.right}
            y2={yHigh}
            stroke="#fdba74"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
          <line
            x1={padding.left}
            y1={yMod}
            x2={width - padding.right}
            y2={yMod}
            stroke="#fde68a"
            strokeDasharray="3 3"
            strokeWidth="1"
          />

          {/* Y Axis labels */}
          <text
            x={padding.left - 6}
            y={padding.top + 4}
            textAnchor="end"
            fontSize="9"
            fill="#94a3b8"
          >
            100
          </text>
          <text
            x={padding.left - 6}
            y={yUrgent + 3}
            textAnchor="end"
            fontSize="9"
            fill="#ef4444"
          >
            75
          </text>
          <text
            x={padding.left - 6}
            y={yHigh + 3}
            textAnchor="end"
            fontSize="9"
            fill="#f97316"
          >
            50
          </text>
          <text
            x={padding.left - 6}
            y={yMod + 3}
            textAnchor="end"
            fontSize="9"
            fill="#f59e0b"
          >
            25
          </text>
          <text
            x={padding.left - 6}
            y={padding.top + chartHeight + 3}
            textAnchor="end"
            fontSize="9"
            fill="#94a3b8"
          >
            0
          </text>

          {/* Trendline Path */}
          {sorted.length > 1 && (
            <polyline
              fill="none"
              stroke="#0284c7"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points}
            />
          )}

          {/* Data Points */}
          {sorted.map((d, i) => {
            const cx = getX(i);
            const cy = getY(d.risk_score);
            return (
              <g key={d.date} className="cursor-pointer">
                <circle
                  cx={cx}
                  cy={cy}
                  r="4.5"
                  className="fill-white stroke-sky-600 stroke-2 hover:r-6 hover:stroke-sky-800 transition-all"
                />
                <title>{`${d.date}: Score ${d.risk_score} (${d.risk_level})`}</title>
              </g>
            );
          })}

          {/* X Axis Date Labels */}
          {sorted.map((d, i) => {
            // Show label on first, last, and every few points to prevent crowding
            const shouldShow =
              i === 0 ||
              i === sorted.length - 1 ||
              sorted.length <= 5 ||
              i % Math.ceil(sorted.length / 4) === 0;

            if (!shouldShow) return null;
            return (
              <text
                key={`label-${d.date}`}
                x={getX(i)}
                y={padding.top + chartHeight + 18}
                textAnchor="middle"
                fontSize="9"
                fill="#64748b"
              >
                {d.date.substring(5)}
              </text>
            );
          })}
        </svg>

        {/* Screen Reader Accessible Data Table */}
        <table className="sr-only">
          <caption>Longitudinal Risk Scores</caption>
          <thead>
            <tr>
              <th>Date</th>
              <th>Risk Score</th>
              <th>Risk Band</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((d) => (
              <tr key={d.date}>
                <td>{d.date}</td>
                <td>{d.risk_score}</td>
                <td>{d.risk_level}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};


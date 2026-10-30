import React from "react";
import { RiskLevel } from "@/types/domain";
import { formatRiskLevel, getRiskBadgeClasses } from "@/lib/formatting";

interface RiskDistributionChartProps {
  distribution: Record<RiskLevel, number>;
  total: number;
  onSelectCategory?: (category: RiskLevel) => void;
}

export const RiskDistributionChart: React.FC<RiskDistributionChartProps> = ({
  distribution,
  total,
  onSelectCategory,
}) => {
  const categories: RiskLevel[] = ["LOW", "MODERATE", "HIGH", "URGENT_REVIEW"];

  return (
    <div
      className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"
      aria-label="Population Risk Distribution Chart"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Cohort Risk Distribution
          </h3>
          <p className="text-xs text-slate-500">
            Categorized across {total} monitored seniors
          </p>
        </div>
        <span className="text-xs px-2 py-0.5 font-medium bg-slate-100 text-slate-600 rounded">
          Decision Support
        </span>
      </div>

      {/* Visual Bar Distribution */}
      <div className="space-y-3">
        {categories.map((cat) => {
          const count = distribution[cat] || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const styles = getRiskBadgeClasses(cat);
          const isClickable = Boolean(onSelectCategory);

          return (
            <div
              key={cat}
              onClick={() => onSelectCategory?.(cat)}
              className={`group ${
                isClickable ? "cursor-pointer" : ""
              } flex flex-col gap-1`}
              role={isClickable ? "button" : undefined}
              tabIndex={isClickable ? 0 : undefined}
              onKeyDown={(e) => {
                if (isClickable && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onSelectCategory?.(cat);
                }
              }}
              aria-label={`${formatRiskLevel(cat)}: ${count} seniors (${pct}%)`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${styles.dot}`}
                    aria-hidden="true"
                  />
                  {formatRiskLevel(cat)}
                </span>
                <span className="font-semibold text-slate-900">
                  {count} <span className="font-normal text-slate-400">({pct}%)</span>
                </span>
              </div>

              {/* Bar track */}
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${styles.dot}`}
                  style={{ width: `${Math.max(pct, count > 0 ? 3 : 0)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span>Bands: Low (0-24), Mod (25-49), High (50-74), Urgent (75-100)</span>
      </div>
    </div>
  );
};


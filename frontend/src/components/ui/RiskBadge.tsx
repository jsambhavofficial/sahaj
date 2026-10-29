import React from "react";
import { RiskLevel } from "@/types/domain";
import { formatRiskLevel, getRiskBadgeClasses } from "@/lib/formatting";
import { cn } from "@/lib/utils";

interface RiskBadgeProps {
  level: RiskLevel | string | undefined | null;
  className?: string;
  showDot?: boolean;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  level,
  className,
  showDot = true,
}) => {
  const styles = getRiskBadgeClasses(level);
  const label = formatRiskLevel(level);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border",
        styles.bg,
        styles.border,
        styles.text,
        className
      )}
      role="status"
      aria-label={`Risk level: ${label}`}
    >
      {showDot && (
        <span
          className={cn("w-1.5 h-1.5 rounded-full", styles.dot)}
          aria-hidden="true"
        />
      )}
      <span>{label}</span>
    </span>
  );
};


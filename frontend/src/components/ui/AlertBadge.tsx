import React from "react";
import { AlertStatus } from "@/types/domain";
import { formatAlertStatus, getAlertStatusClasses } from "@/lib/formatting";
import { cn } from "@/lib/utils";

interface AlertBadgeProps {
  status: AlertStatus | string | undefined | null;
  className?: string;
}

export const AlertBadge: React.FC<AlertBadgeProps> = ({ status, className }) => {
  const styles = getAlertStatusClasses(status);
  const label = formatAlertStatus(status);

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
      aria-label={`Alert status: ${label}`}
    >
      <span
        className={cn("w-1.5 h-1.5 rounded-full", styles.dot)}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
};


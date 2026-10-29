import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  variant?: "default" | "warning" | "danger" | "success" | "info";
  onClick?: () => void;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  variant = "default",
  onClick,
  className,
}) => {
  const variantStyles = {
    default: "bg-white border-slate-200 text-slate-900",
    warning: "bg-amber-50/50 border-amber-200 text-amber-950",
    danger: "bg-red-50/50 border-red-200 text-red-950",
    success: "bg-emerald-50/50 border-emerald-200 text-emerald-950",
    info: "bg-sky-50/50 border-sky-200 text-sky-950",
  };

  const isClickable = Boolean(onClick);

  return (
    <div
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (isClickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={cn(
        "p-5 rounded-xl border transition-all duration-150 flex flex-col justify-between shadow-sm",
        variantStyles[variant],
        isClickable &&
          "cursor-pointer hover:shadow-md hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </span>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>
      <div>
        <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          {value}
        </div>
        {subtitle && (
          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};


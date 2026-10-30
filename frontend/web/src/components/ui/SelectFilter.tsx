import React from "react";
import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
}

interface SelectFilterProps {
  label: string;
  id: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  className?: string;
}

export const SelectFilter: React.FC<SelectFilterProps> = ({
  label,
  id,
  value,
  options,
  onChange,
  className,
}) => {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center gap-1.5", className)}>
      <label htmlFor={id} className="text-xs font-semibold text-slate-600 shrink-0">
        {label}:
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs font-medium bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};


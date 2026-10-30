import React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = "Search...",
  label = "Search records",
  className,
}) => {
  return (
    <div className={cn("relative flex items-center", className)}>
      <label htmlFor="search-input" className="sr-only">
        {label}
      </label>
      <Search
        className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none"
        aria-hidden="true"
      />
      <input
        id="search-input"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search input"
          className="absolute right-2.5 p-0.5 rounded text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};


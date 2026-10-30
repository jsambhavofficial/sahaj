import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Failed to load data",
  message,
  onRetry,
  className,
}) => {
  return (
    <div
      role="alert"
      className={cn(
        "p-6 rounded-xl border border-red-200 bg-red-50 text-red-900 flex flex-col items-center text-center",
        className
      )}
    >
      <AlertCircle className="w-10 h-10 text-red-600 mb-2" />
      <h3 className="text-sm font-semibold text-red-900">{title}</h3>
      <p className="mt-1 text-xs text-red-700 max-w-md leading-relaxed">
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          type="button"
          className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Try again</span>
        </button>
      )}
    </div>
  );
};


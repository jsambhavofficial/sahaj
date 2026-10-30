import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = "Loading records...",
  className,
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "flex flex-col items-center justify-center p-12 text-center text-slate-500",
        className
      )}
    >
      <Loader2 className="w-8 h-8 animate-spin text-brand-600 mb-3" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
};


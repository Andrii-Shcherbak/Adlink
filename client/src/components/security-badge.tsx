import { Shield, ShieldCheck, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SecurityLevel } from "@/lib/utils";

interface SecurityBadgeProps {
  level: SecurityLevel;
  className?: string;
}

export function SecurityBadge({ level, className }: SecurityBadgeProps) {
  const icons = {
    high: ShieldCheck,
    medium: Shield,
    low: ShieldAlert,
  };

  const Icon = icons[level];
  const labels = {
    high: "Protected Link",
    medium: "Public Link",
    low: "Low Security",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium",
        {
          "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400":
            level === "high",
          "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400":
            level === "medium",
          "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400":
            level === "low",
        },
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{labels[level]}</span>
    </div>
  );
}
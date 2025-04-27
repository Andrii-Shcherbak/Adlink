import { Shield, ShieldCheck, ShieldAlert } from "lucide-react";
import { cn, getUrlSecurityLevel } from "@/lib/utils";
import type { SecurityLevel } from "@/lib/utils";
import type { Url } from "@shared/schema";

interface SecurityBadgeProps {
  level?: SecurityLevel;
  url?: Url;
  className?: string;
}

export function SecurityBadge({ level, url, className }: SecurityBadgeProps) {
  // If a url is provided, get its security level
  const securityLevel = url ? getUrlSecurityLevel(url) : level;
  
  // If neither level nor url is provided, default to medium
  const finalLevel = securityLevel || 'medium';
  
  const icons = {
    high: ShieldCheck,
    medium: Shield,
    low: ShieldAlert,
  };

  const Icon = icons[finalLevel];
  const labels = {
    high: "Protected Link",
    medium: "Public Link",
    low: "Low Security",
  };

  // New color scheme for our updated dark mode/apple design
  const colorClasses = {
    high: "bg-green-500/10 border border-green-500/30 text-green-400",
    medium: "bg-blue-500/10 border border-blue-500/30 text-blue-400",
    low: "bg-red-500/10 border border-red-500/30 text-red-400",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium",
        colorClasses[finalLevel],
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{labels[finalLevel]}</span>
    </div>
  );
}
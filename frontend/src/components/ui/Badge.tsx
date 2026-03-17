import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const variants = {
  green: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20",
  blue: "bg-brand-500/10 text-brand-400 ring-1 ring-brand-500/20",
  purple: "bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20",
  yellow: "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
  red: "bg-red-500/10 text-red-400 ring-1 ring-red-500/20",
  cyan: "bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/20",
};

interface BadgeProps {
  variant?: keyof typeof variants;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}

export function Badge({ variant = "blue", children, className, dot }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {dot && (
        <span className={cn(
          "h-1.5 w-1.5 rounded-full",
          variant === "green" ? "bg-emerald-400" :
          variant === "yellow" ? "bg-amber-400" :
          variant === "red" ? "bg-red-400" :
          "bg-brand-400"
        )} />
      )}
      {children}
    </span>
  );
}

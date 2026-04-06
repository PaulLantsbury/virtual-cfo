import { TrendingUp, TrendingDown, Minus, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export type DriverTrend = "improving" | "worsening" | "neutral";

export interface Driver {
  id: string;
  text: string;
  trend: DriverTrend;
  href?: string;
}

interface TopDriversProps {
  drivers: Driver[];
  isLoading?: boolean;
}

const trendConfig: Record<DriverTrend, { label: string; classes: string }> = {
  improving: { label: "↑", classes: "text-success bg-success/10" },
  worsening: { label: "↓", classes: "text-destructive bg-destructive/10" },
  neutral:   { label: "–", classes: "text-muted-foreground bg-secondary" },
};

export function TopDrivers({ drivers, isLoading }: TopDriversProps) {
  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6 mb-8">
      <div className="mb-5">
        <h3 className="font-semibold text-lg text-foreground">Top Drivers This Month</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          What changed this month and how it affected financial performance
        </p>
      </div>

      {isLoading ? (
        <ul className="space-y-3">
          {Array(4).fill(0).map((_, i) => (
            <li key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-7 h-7 rounded-lg bg-secondary shrink-0" />
              <div className="h-4 bg-secondary rounded w-3/4" />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-0.5">
          {drivers.map((driver) => {
            const { label, classes } = trendConfig[driver.trend];
            const content = (
              <>
                <span className={cn(
                  "inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold shrink-0",
                  classes,
                )}>
                  {label}
                </span>
                <span className="flex-1 text-sm text-foreground leading-snug">
                  {driver.text}
                </span>
                {driver.href && (
                  <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0 group-hover:text-muted-foreground/60 transition-colors" />
                )}
              </>
            );

            return driver.href ? (
              <li key={driver.id}>
                <Link
                  href={driver.href}
                  className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-xl hover:bg-secondary/50 transition-colors group"
                >
                  {content}
                </Link>
              </li>
            ) : (
              <li key={driver.id} className="flex items-center gap-3 py-2.5">
                {content}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

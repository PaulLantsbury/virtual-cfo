import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type DriverTrend = "improving" | "worsening" | "neutral";

export interface Driver {
  id: string;
  text: string;
  trend: DriverTrend;
}

interface TopDriversProps {
  drivers: Driver[];
  isLoading?: boolean;
}

const trendConfig: Record<DriverTrend, { icon: React.ElementType; label: string; classes: string }> = {
  improving: {
    icon: TrendingUp,
    label: "↑",
    classes: "text-success bg-success/10",
  },
  worsening: {
    icon: TrendingDown,
    label: "↓",
    classes: "text-destructive bg-destructive/10",
  },
  neutral: {
    icon: Minus,
    label: "–",
    classes: "text-muted-foreground bg-secondary",
  },
};

export function TopDrivers({ drivers, isLoading }: TopDriversProps) {
  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6 mb-8">
      <div className="mb-5">
        <h3 className="font-semibold text-lg text-foreground">Top Drivers This Month</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Key factors affecting your financial performance this period
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
        <ul className="space-y-3">
          {drivers.map((driver) => {
            const { icon: Icon, label, classes } = trendConfig[driver.trend];
            return (
              <li
                key={driver.id}
                className="flex items-center gap-3 group"
              >
                <span
                  className={cn(
                    "inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold shrink-0 transition-transform group-hover:scale-110",
                    classes
                  )}
                  aria-label={driver.trend}
                >
                  {label}
                </span>
                <span className="text-sm text-foreground leading-snug">{driver.text}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

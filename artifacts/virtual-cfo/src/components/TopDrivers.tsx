import { ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export type DriverTrend = "improving" | "worsening" | "neutral";

export interface Driver {
  id: string;
  /** Direction-level text — always visible on free plan */
  text: string;
  trend: DriverTrend;
  href?: string;
  /**
   * Pro-only enriched detail line: quantified impact, CAC-adjusted figures,
   * margin/revenue equivalents. Only rendered when `isPro` is true.
   */
  proDetail?: string;
}

interface TopDriversProps {
  drivers: Driver[];
  /**
   * When true, renders `proDetail` lines beneath each driver text.
   * Pass `canAccess("dashboard_driver_detail")` from the parent.
   */
  isPro?: boolean;
  isLoading?: boolean;
}

const trendConfig: Record<DriverTrend, { label: string; classes: string }> = {
  improving: { label: "↑", classes: "text-success bg-success/10" },
  worsening: { label: "↓", classes: "text-destructive bg-destructive/10" },
  neutral:   { label: "–", classes: "text-muted-foreground bg-secondary" },
};

export function TopDrivers({ drivers, isPro = false, isLoading }: TopDriversProps) {
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
            const showDetail = isPro && !!driver.proDetail;

            const content = (
              <>
                <span className={cn(
                  "inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold shrink-0 self-start mt-0.5",
                  classes,
                )}>
                  {label}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-foreground leading-snug">
                    {driver.text}
                  </span>
                  {showDetail && (
                    <span className="block text-xs text-muted-foreground mt-0.5 leading-snug">
                      {driver.proDetail}
                    </span>
                  )}
                </span>
                {driver.href && (
                  <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0 group-hover:text-muted-foreground/60 transition-colors self-start mt-1" />
                )}
              </>
            );

            return driver.href ? (
              <li key={driver.id}>
                <Link
                  href={driver.href}
                  className="flex items-start gap-3 py-2.5 px-2 -mx-2 rounded-xl hover:bg-secondary/50 transition-colors group"
                >
                  {content}
                </Link>
              </li>
            ) : (
              <li key={driver.id} className="flex items-start gap-3 py-2.5">
                {content}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

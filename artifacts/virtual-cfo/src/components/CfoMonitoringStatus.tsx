import { useState, useRef } from "react";
import { Lock, ArrowRight, Activity } from "lucide-react";
import { useLocation } from "wouter";
import { isProUser } from "@/lib/plan";
import { cn } from "@/lib/utils";

// ─── Status config ────────────────────────────────────────────────────────────

type MonitorStatus = "green" | "amber" | "red";

interface StatusConfig {
  label: string;
  tooltip: string;
  dot: string;
  pulse: string;
  pill: string;
  text: string;
}

const STATUS_CONFIG: Record<MonitorStatus, StatusConfig> = {
  green: {
    label: "Monitoring active",
    tooltip: "No urgent issues detected.",
    dot:   "bg-emerald-500",
    pulse: "bg-emerald-400",
    pill:  "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300",
    text:  "text-emerald-700 dark:text-emerald-400",
  },
  amber: {
    label: "Action recommended",
    tooltip: "Your AI CFO is monitoring margin, cash, marketing efficiency and pricing signals. 3 areas need attention.",
    dot:   "bg-amber-500",
    pulse: "bg-amber-400",
    pill:  "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300",
    text:  "text-amber-700 dark:text-amber-400",
  },
  red: {
    label: "Immediate attention",
    tooltip: "Critical movement detected in cash runway or margin.",
    dot:   "bg-red-500",
    pulse: "bg-red-400",
    pill:  "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-300",
    text:  "text-red-700 dark:text-red-400",
  },
};

// Default state — amber / action recommended
const CURRENT_STATUS: MonitorStatus = "amber";

const POPOVER_ITEMS = [
  { area: "Margin quality",       status: "Watch",   dot: "bg-amber-400" },
  { area: "Meta CAC",             status: "At risk",  dot: "bg-red-500"   },
  { area: "Discount dependency",  status: "Watch",   dot: "bg-amber-400" },
  { area: "Cash runway",          status: "Monitor", dot: "bg-blue-400"  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function CfoMonitoringStatus() {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const isPro = isProUser();
  const config = STATUS_CONFIG[CURRENT_STATUS];
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  }

  function hide() {
    timeoutRef.current = setTimeout(() => setOpen(false), 120);
  }

  function goToAlerts() {
    navigate("/cfo-alerts");
    setOpen(false);
  }

  return (
    <div className="relative" onMouseLeave={hide}>
      {/* ── Pill badge ───────────────────────────────────────────────────── */}
      <button
        onClick={goToAlerts}
        onMouseEnter={show}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors select-none",
          config.pill,
          "hover:opacity-80"
        )}
        title={config.tooltip}
        aria-label="CFO Monitoring Status — click to view alerts"
      >
        {/* Pulse dot */}
        <span className="relative flex items-center justify-center w-2.5 h-2.5 shrink-0">
          <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping", config.pulse)} />
          <span className={cn("relative inline-flex rounded-full w-1.5 h-1.5", config.dot)} />
        </span>

        {/* Label — hidden on very small screens */}
        <span className="hidden sm:inline leading-none">CFO Monitoring</span>

        {/* Status label — hidden on mobile */}
        <span className={cn("hidden sm:inline leading-none font-bold", config.text)}>
          · {config.label}
        </span>

        {/* Free lock icon */}
        {!isPro && (
          <Lock className="w-2.5 h-2.5 opacity-60 shrink-0" />
        )}
      </button>

      {/* ── Hover popover ─────────────────────────────────────────────────── */}
      {open && (
        <div
          onMouseEnter={show}
          onMouseLeave={hide}
          className="absolute right-0 top-full mt-2 w-64 z-50 bg-background border border-border rounded-2xl shadow-xl overflow-hidden"
        >
          {/* Popover header */}
          <div className="px-4 py-3 border-b border-border/60 bg-secondary/30">
            <div className="flex items-center gap-2">
              <Activity className={cn("w-3.5 h-3.5 shrink-0", config.text)} />
              <p className="text-xs font-bold text-foreground">CFO Monitoring Status</p>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isPro
                ? "CFO monitoring active — live signals."
                : "Monitoring preview available. Upgrade to Pro to activate alerts."}
            </p>
          </div>

          {/* Monitored areas */}
          <div className="px-4 py-3 space-y-2">
            {POPOVER_ITEMS.map(({ area, status, dot }) => (
              <div key={area} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={cn("w-2 h-2 rounded-full shrink-0", dot)} />
                  <span className="text-xs text-foreground/80">{area}</span>
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground">{status}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="px-4 py-3 border-t border-border/60 bg-secondary/20">
            <button
              onClick={goToAlerts}
              className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
            >
              View alerts
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

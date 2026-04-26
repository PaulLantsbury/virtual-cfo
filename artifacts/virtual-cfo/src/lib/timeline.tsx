import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

export const TIMELINE_OPTIONS = [
  { value: "this_month",  label: "This month"    },
  { value: "last_month",  label: "Last month"    },
  { value: "last_30",     label: "Last 30 days"  },
  { value: "last_90",     label: "Last 90 days"  },
  { value: "last_12m",    label: "Last 12 months"},
  { value: "custom",      label: "Custom range"  },
] as const;

export type TimelineValue = typeof TIMELINE_OPTIONS[number]["value"];

/** Human-readable inline phrase for use inside section subtitles. */
export const PERIOD_PHRASE: Record<TimelineValue, string> = {
  this_month: "this month",
  last_month: "last month",
  last_30:    "the last 30 days",
  last_90:    "the last 90 days",
  last_12m:   "the last 12 months",
  custom:     "the selected period",
};

/** Short date-range badge label shown next to the selector. */
export const PERIOD_BADGE: Record<TimelineValue, string> = {
  this_month: "March 2026",
  last_month: "February 2026",
  last_30:    "1 Mar – 31 Mar 2026",
  last_90:    "Jan – Mar 2026",
  last_12m:   "Apr 2025 – Mar 2026",
  custom:     "Custom range",
};

export const COMPARE_LABEL = "Compare to: Previous period";

type TimelineContextType = {
  timeline: TimelineValue;
  setTimeline: (v: TimelineValue) => void;
  selectedLabel: string;
  periodPhrase: string;
  periodBadge: string;
};

const TimelineContext = createContext<TimelineContextType | null>(null);

export function TimelineProvider({ children }: { children: ReactNode }) {
  const [timeline, setTimeline] = useState<TimelineValue>("this_month");

  const opt = TIMELINE_OPTIONS.find((o) => o.value === timeline)!;

  return (
    <TimelineContext.Provider
      value={{
        timeline,
        setTimeline,
        selectedLabel: opt.label,
        periodPhrase: PERIOD_PHRASE[timeline],
        periodBadge: PERIOD_BADGE[timeline],
      }}
    >
      {children}
    </TimelineContext.Provider>
  );
}

export function useTimeline() {
  const ctx = useContext(TimelineContext);
  if (!ctx) throw new Error("useTimeline must be used within <TimelineProvider>");
  return ctx;
}

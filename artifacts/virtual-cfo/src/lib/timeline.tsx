import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

export const TIMELINE_OPTIONS = [
  { value: "7d",  label: "Last 7 days"    },
  { value: "30d", label: "Last 30 days"   },
  { value: "90d", label: "Last 90 days"   },
  { value: "12m", label: "Last 12 months" },
] as const;

export type TimelineValue = typeof TIMELINE_OPTIONS[number]["value"];

/** Human-readable inline phrase for use inside section subtitles. */
export const PERIOD_PHRASE: Record<TimelineValue, string> = {
  "7d":  "the last 7 days",
  "30d": "the last 30 days",
  "90d": "the last 90 days",
  "12m": "the last 12 months",
};

/** Short date-range badge label shown next to the selector. */
export const PERIOD_BADGE: Record<TimelineValue, string> = {
  "7d":  "28 Mar – 4 Apr 2026",
  "30d": "March 2026",
  "90d": "Jan – Mar 2026",
  "12m": "Apr 2025 – Mar 2026",
};

type TimelineContextType = {
  timeline: TimelineValue;
  setTimeline: (v: TimelineValue) => void;
  selectedLabel: string;
  periodPhrase: string;
  periodBadge: string;
};

const TimelineContext = createContext<TimelineContextType | null>(null);

export function TimelineProvider({ children }: { children: ReactNode }) {
  const [timeline, setTimeline] = useState<TimelineValue>("30d");

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

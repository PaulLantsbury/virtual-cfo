import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

export const TIMELINE_OPTIONS = [
  { value: "last_complete_week",  label: "Last Complete Week"  },
  { value: "last_complete_month", label: "Last Complete Month" },
] as const;

export type TimelineValue = typeof TIMELINE_OPTIONS[number]["value"];

/** Human-readable inline phrase for use inside section subtitles. */
export const PERIOD_PHRASE: Record<TimelineValue, string> = {
  last_complete_week:  "the last complete week",
  last_complete_month: "the last complete month",
};

/** Short date-range badge label shown next to the selector. */
export const PERIOD_BADGE: Record<TimelineValue, string> = {
  last_complete_week:  "Weekly review",
  last_complete_month: "Monthly review",
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
  const [timeline, setTimeline] = useState<TimelineValue>("last_complete_month");

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

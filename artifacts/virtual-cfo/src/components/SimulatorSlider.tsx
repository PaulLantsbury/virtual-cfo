import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

/**
 * SimulatorSlider — shared slider row used across all simulator sections.
 *
 * Pages: Profit Engine, Cash Control, Pricing Optimisation.
 * Replaces per-page duplicate SliderRow implementations.
 *
 * Props
 * ─────
 * label          Row label (also used as aria-label for accessibility).
 * value          Current numeric value.
 * min / max      Track bounds.
 * step           Increment size.
 * unit           Suffix appended to displayed value and range labels (e.g. "%" or "pp").
 * showSign       Prefix positive values with "+".
 * description    Optional centre caption shown below the track.
 * positiveIsGood Controls colour coding: true → positive = green, false → positive = red.
 * onChange       Called with the new value whenever the handle moves.
 */

export interface SimulatorSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  showSign?: boolean;
  description?: string;
  positiveIsGood?: boolean;
  onChange: (v: number) => void;
}

export function SimulatorSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  showSign,
  description,
  positiveIsGood = true,
  onChange,
}: SimulatorSliderProps) {
  const valueGood = positiveIsGood ? value > 0 : value < 0;
  const valueBad  = positiveIsGood ? value < 0 : value > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <span
          className={cn(
            "text-sm font-bold tabular-nums px-2 py-0.5 rounded-md min-w-[4rem] text-right",
            valueGood
              ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20"
              : valueBad
              ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20"
              : "text-muted-foreground bg-secondary",
          )}
        >
          {showSign && value > 0 ? "+" : ""}
          {value % 1 === 0 ? value : value.toFixed(1)}
          {unit}
        </span>
      </div>

      <Slider
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(vals) => onChange(vals[0])}
      />

      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>{showSign && min > 0 ? "+" : ""}{min}{unit}</span>
        {description && (
          <span className="text-center flex-1 px-2 text-[10px] text-muted-foreground/70 truncate">
            {description}
          </span>
        )}
        <span>+{max}{unit}</span>
      </div>
    </div>
  );
}

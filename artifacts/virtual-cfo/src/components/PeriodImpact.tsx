import { cn } from "@/lib/utils";

interface PeriodImpactProps {
  value: number;
  positive?: boolean;
  showAnnual?: boolean;
  className?: string;
  valueClassName?: string;
}

export function PeriodImpact({
  value,
  positive,
  showAnnual = true,
  className,
  valueClassName,
}: PeriodImpactProps) {
  const rounded = Math.round(value);
  const isGood = positive !== undefined ? positive : rounded >= 0;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  const absVal = Math.abs(rounded);
  const annualisedAbs = Math.abs(Math.round(value * 12));

  const colourClass =
    rounded === 0
      ? "text-muted-foreground"
      : isGood
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-destructive";

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className={cn("font-bold tabular-nums leading-none", colourClass, valueClassName)}>
        {sign}£{absVal.toLocaleString()}
        <span className="font-normal text-[11px] text-muted-foreground ml-1.5">(30 days)</span>
      </span>
      {showAnnual && rounded !== 0 && (
        <span className="text-[10px] text-muted-foreground/80 tabular-nums leading-none">
          {sign}£{annualisedAbs.toLocaleString()} ann.
        </span>
      )}
    </div>
  );
}

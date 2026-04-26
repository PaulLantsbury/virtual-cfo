import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataBenchmarkAssumptionsProps {
  benchmarkNote: string;
  dataQualityNote: string;
  confidenceNote?: string;
  className?: string;
}

export function DataBenchmarkAssumptions({
  benchmarkNote,
  dataQualityNote,
  confidenceNote,
  className,
}: DataBenchmarkAssumptionsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("rounded-xl border border-border/40 bg-secondary/20", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Data &amp; benchmark assumptions
        </span>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-0 border-t border-border/30 space-y-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1">
              Benchmark context
            </p>
            <p className="text-xs text-muted-foreground/80 leading-relaxed">{benchmarkNote}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1">
              Data quality
            </p>
            <p className="text-xs text-muted-foreground/80 leading-relaxed">{dataQualityNote}</p>
          </div>
          {confidenceNote && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1">
                Confidence
              </p>
              <p className="text-xs text-muted-foreground/80 leading-relaxed">{confidenceNote}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

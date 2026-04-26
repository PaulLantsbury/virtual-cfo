import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataQualityNoteProps {
  note:       string;
  className?: string;
}

/**
 * Subtle data quality flag shown at page level.
 * Uses neutral styling — not alarm/warning colours — to indicate
 * data mapping assumptions without alarming the user.
 */
export function DataQualityNote({ note, className }: DataQualityNoteProps) {
  return (
    <div className={cn(
      "flex items-start gap-2.5 rounded-xl border border-border/40 bg-secondary/30 px-4 py-3 mb-6",
      className,
    )}>
      <Info className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-0.5">
          Data quality note
        </p>
        <p className="text-xs text-muted-foreground/80 leading-relaxed">{note}</p>
      </div>
    </div>
  );
}

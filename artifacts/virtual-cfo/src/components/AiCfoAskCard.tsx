import { useState } from "react";
import { Sparkles, Loader2, Lock } from "lucide-react";
import { useAiCfo } from "@/components/AiCfoProvider";
import { AI_CFO_RESPONSES, type PageId } from "@/lib/aiCfoResponses";
import { canAccess } from "@/lib/plan";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AiCfoAskCardProps {
  pageId: PageId;
  className?: string;
}

export function AiCfoAskCard({ pageId, className }: AiCfoAskCardProps) {
  const { openDrawer } = useAiCfo();
  const [loading, setLoading] = useState(false);
  const hasActionPlans = canAccess("ai_cfo_action_plans");
  const data = AI_CFO_RESPONSES[pageId];

  function handleClick() {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      openDrawer(pageId);
    }, 600);
  }

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-primary/25 bg-primary/5 px-5 py-4 mb-6",
        className
      )}
    >
      {/* Icon + text */}
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/15 shrink-0 mt-0.5">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Ask your AI CFO</p>
            {!hasActionPlans && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary/70 border border-primary/20">
                <Lock className="w-2.5 h-2.5" />
                Action plan — Pro
              </span>
            )}
          </div>
          <p className="text-sm text-foreground/85 leading-snug truncate sm:whitespace-normal">
            {data.question}
          </p>
        </div>
      </div>

      {/* Button */}
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 font-semibold transition-colors"
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            Analysing…
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Get Analysis
          </>
        )}
      </Button>
    </div>
  );
}

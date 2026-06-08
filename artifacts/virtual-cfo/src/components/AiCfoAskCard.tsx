import { useState, useRef, KeyboardEvent } from "react";
import { Sparkles, Loader2, Lock, Send } from "lucide-react";
import { useAiCfo } from "@/components/AiCfoProvider";
import { AI_CFO_RESPONSES, type PageId } from "@/lib/aiCfoResponses";
import { canAccess } from "@/lib/plan";
import { cn } from "@/lib/utils";

interface AiCfoAskCardProps {
  pageId: PageId;
  className?: string;
}

export function AiCfoAskCard({ pageId, className }: AiCfoAskCardProps) {
  const { openDrawer } = useAiCfo();
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const hasActionPlans = canAccess("ai_cfo_action_plans");
  const data = AI_CFO_RESPONSES[pageId];
  const inputRef = useRef<HTMLInputElement>(null);

  function triggerAnalysis(customQuestion?: string) {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      openDrawer(pageId, customQuestion);
      setInputValue("");
    }, 600);
  }

  function handleAsk() {
    const q = inputValue.trim();
    triggerAnalysis(q || undefined);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleAsk();
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-primary/25 bg-primary/5 px-5 py-4 mb-6",
        className
      )}
    >
      {/* Label row */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/15 shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
        </div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Ask Night Scout</p>
        {!hasActionPlans && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary/70 border border-primary/20">
            <Lock className="w-2.5 h-2.5" />
            Action plan — Pro
          </span>
        )}
      </div>

      {/* Input row */}
      <div className="flex items-center gap-2 mb-3">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about this page…"
          disabled={loading}
          className="flex-1 min-w-0 text-sm bg-background border border-border/60 rounded-xl px-3 py-2 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-colors disabled:opacity-60"
        />
        <button
          onClick={handleAsk}
          disabled={loading}
          className={cn(
            "shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-semibold text-sm transition-colors",
            loading
              ? "bg-primary/60 text-white cursor-not-allowed"
              : "bg-primary text-white hover:bg-primary/90"
          )}
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">{loading ? "Analysing…" : "Ask"}</span>
        </button>
      </div>

      {/* Suggested prompt chip */}
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide shrink-0">Suggested:</p>
        <button
          onClick={() => !loading && triggerAnalysis(data.question)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-background border border-border/60 text-foreground/80 hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-colors disabled:opacity-50"
        >
          <Sparkles className="w-3 h-3 text-primary/70" />
          {data.question}
        </button>
      </div>
    </div>
  );
}

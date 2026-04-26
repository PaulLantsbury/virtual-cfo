import { Sparkles, HelpCircle, BarChart2 } from "lucide-react";
import { useAiCfo } from "@/components/AiCfoProvider";
import type { PageId } from "@/lib/aiCfoResponses";
import { cn } from "@/lib/utils";

interface AiCfoInlineButtonsProps {
  pageId: PageId;
  className?: string;
  variant?: "compact" | "full";
}

export function AiCfoInlineButtons({
  pageId,
  className,
  variant = "compact",
}: AiCfoInlineButtonsProps) {
  const { openDrawer } = useAiCfo();

  const buttons = [
    {
      label: "Explain this",
      icon: Sparkles,
      question: undefined,
    },
    {
      label: "What should I do?",
      icon: HelpCircle,
      question: "What should I do about this?",
    },
    {
      label: "Model impact",
      icon: BarChart2,
      question: "Model the financial impact of fixing this.",
    },
  ];

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {buttons.map(({ label, icon: Icon, question }) => (
        <button
          key={label}
          onClick={() => openDrawer(pageId, question)}
          className={cn(
            "inline-flex items-center gap-1 font-semibold rounded-lg border transition-colors",
            variant === "compact"
              ? "text-[10px] px-2 py-1 bg-primary/5 text-primary/80 border-primary/20 hover:bg-primary/15 hover:text-primary hover:border-primary/40"
              : "text-xs px-3 py-1.5 bg-primary/8 text-primary border-primary/25 hover:bg-primary/15 hover:border-primary/50"
          )}
        >
          <Icon className="w-3 h-3 shrink-0" />
          {label}
        </button>
      ))}
    </div>
  );
}

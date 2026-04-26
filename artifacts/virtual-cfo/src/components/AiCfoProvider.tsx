import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { PageId } from "@/lib/aiCfoResponses";

interface AiCfoContextValue {
  isOpen: boolean;
  activePageId: PageId | null;
  activeQuestion: string | null;
  openDrawer: (pageId: PageId, customQuestion?: string) => void;
  closeDrawer: () => void;
}

const AiCfoContext = createContext<AiCfoContextValue | null>(null);

export function AiCfoProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activePageId, setActivePageId] = useState<PageId | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);

  const openDrawer = useCallback((pageId: PageId, customQuestion?: string) => {
    setActivePageId(pageId);
    setActiveQuestion(customQuestion ?? null);
    setIsOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
    setActiveQuestion(null);
  }, []);

  return (
    <AiCfoContext.Provider value={{ isOpen, activePageId, activeQuestion, openDrawer, closeDrawer }}>
      {children}
    </AiCfoContext.Provider>
  );
}

export function useAiCfo(): AiCfoContextValue {
  const ctx = useContext(AiCfoContext);
  if (!ctx) throw new Error("useAiCfo must be used inside AiCfoProvider");
  return ctx;
}

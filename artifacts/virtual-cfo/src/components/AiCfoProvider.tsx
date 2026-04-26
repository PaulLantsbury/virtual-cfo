import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { PageId } from "@/lib/aiCfoResponses";

interface AiCfoContextValue {
  isOpen: boolean;
  activePageId: PageId | null;
  openDrawer: (pageId: PageId) => void;
  closeDrawer: () => void;
}

const AiCfoContext = createContext<AiCfoContextValue | null>(null);

export function AiCfoProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activePageId, setActivePageId] = useState<PageId | null>(null);

  const openDrawer = useCallback((pageId: PageId) => {
    setActivePageId(pageId);
    setIsOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <AiCfoContext.Provider value={{ isOpen, activePageId, openDrawer, closeDrawer }}>
      {children}
    </AiCfoContext.Provider>
  );
}

export function useAiCfo(): AiCfoContextValue {
  const ctx = useContext(AiCfoContext);
  if (!ctx) throw new Error("useAiCfo must be used inside AiCfoProvider");
  return ctx;
}

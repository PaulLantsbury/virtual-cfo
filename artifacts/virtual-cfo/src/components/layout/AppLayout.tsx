import React, { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { FlaskConical, X } from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    setIsDemoMode(sessionStorage.getItem("demoMode") === "true");
  }, []);

  const exitDemo = () => {
    sessionStorage.removeItem("demoMode");
    setIsDemoMode(false);
    window.location.href = "/login";
  };

  return (
    <div
      className="flex h-screen"
      style={{
        background: "#07182E",
      }}
    >
      {/* Subtle vignette depth layer */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 10%, rgba(255,255,255,0.03), transparent 40%)",
        }}
      />

      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        {isDemoMode && (
          <div className="flex items-center justify-between gap-3 px-4 py-2 bg-amber-400/90 text-amber-950 text-sm font-semibold z-30 shrink-0">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4" />
              <span>DEMO MODE — This is sample data only. No real account connected.</span>
            </div>
            <button
              onClick={exitDemo}
              className="flex items-center gap-1 text-xs font-bold hover:opacity-70 transition-opacity"
            >
              <X className="w-3.5 h-3.5" /> Exit demo
            </button>
          </div>
        )}
        <Header />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

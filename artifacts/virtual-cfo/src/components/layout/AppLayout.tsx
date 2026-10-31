import React from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function AppLayout({ children, showMonitoring = true }: { children: React.ReactNode; showMonitoring?: boolean }) {
  return (
    <div
      className="flex h-full"
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
        <Header showMonitoring={showMonitoring} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

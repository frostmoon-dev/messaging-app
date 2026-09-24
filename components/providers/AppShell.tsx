"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { ChatProvider } from "./ChatProvider";
import { BottomNav } from "@/components/navigation/BottomNav";
import { Sidebar } from "@/components/navigation/Sidebar";
import { DesktopHeader } from "@/components/navigation/DesktopHeader";
import { useViewportHeight } from "@/lib/hooks/useViewportHeight";
import type { BondRow, Session } from "@/types/app";

export function AppShell({
  session,
  bond,
  children,
}: {
  session: Session;
  bond: BondRow | null;
  children: ReactNode;
}) {
  useViewportHeight();

  return (
    <MotionConfig reducedMotion="user">
      <ChatProvider session={session} initialBond={bond}>
        <div className="app-height fixed inset-x-0 top-0 flex flex-col overflow-hidden bg-background">
          <a
            href="#main"
            className="sr-only-focusable absolute top-2 left-2 z-50 rounded-control bg-accent px-3 py-2 font-semibold text-accent-foreground"
          >
            Skip to content
          </a>
          <DesktopHeader />
          <div className="flex min-h-0 flex-1">
            <Sidebar />
            <main id="main" className="relative flex min-h-0 min-w-0 flex-1 flex-col">
              {children}
            </main>
          </div>
          <BottomNav />
        </div>
      </ChatProvider>
    </MotionConfig>
  );
}

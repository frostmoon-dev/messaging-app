"use client";

import { useEffect, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { ChatProvider } from "./ChatProvider";
import { BottomNav } from "@/components/navigation/BottomNav";
import { AlertCenter } from "@/components/alerts/AlertCenter";
import { LocationSharer } from "@/components/map/LocationSharer";
import { Sidebar } from "@/components/navigation/Sidebar";
import { DesktopHeader } from "@/components/navigation/DesktopHeader";
import { useViewportHeight } from "@/lib/hooks/useViewportHeight";
import { notificationsEnabled } from "@/lib/notifications";
import { enablePush } from "@/lib/push";
import { devLog } from "@/lib/utils";
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

  // Push addresses can change (browser updates, a new server key). Refresh
  // this device's address on every start while alerts are on.
  useEffect(() => {
    if (notificationsEnabled()) void enablePush().catch((error) => devLog("push refresh failed", error));
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <ChatProvider session={session} initialBond={bond}>
        <div className="app-height app-backdrop fixed bg-background inset-x-0 top-0 flex flex-col overflow-hidden">
          <a
            href="#main"
            className="sr-only-focusable absolute top-2 left-2 z-50 bg-accent px-3 py-2 font-semibold text-accent-foreground"
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
          <AlertCenter />
          <LocationSharer />
        </div>
      </ChatProvider>
    </MotionConfig>
  );
}

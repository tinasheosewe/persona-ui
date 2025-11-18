"use client";

import { SessionSidebar } from "@/components/assistant-ui/session-sidebar";
import { Thread } from "@/components/assistant-ui/thread";

export default function Home() {
  return (
    <main className="h-dvh flex bg-background">
      <SessionSidebar />
      <div className="flex-1 min-w-0 h-full">
        <Thread />
      </div>
    </main>
  );
}

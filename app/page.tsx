"use client";

import { useState } from "react";
import { MenuIcon } from "lucide-react";
import { SessionSidebar } from "@/components/assistant-ui/session-sidebar";
import { Thread } from "@/components/assistant-ui/thread";

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <main className="flex h-full min-h-0 flex-1 flex-col bg-background md:flex-row">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
        <button
          type="button"
          aria-label="Open chat list"
          onClick={() => setSidebarOpen(true)}
          className="inline-flex size-10 items-center justify-center rounded-md border border-border bg-card text-foreground shadow-sm"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
        <p className="text-sm font-semibold">Chatbot</p>
        <span className="inline-block size-10" aria-hidden />
      </div>

      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close chat list"
            className="md:hidden fixed inset-0 z-30 bg-background/70 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <SessionSidebar
          mobileOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="flex h-full min-w-0 flex-1">
          <Thread />
        </div>
      </div>
    </main>
  );
}

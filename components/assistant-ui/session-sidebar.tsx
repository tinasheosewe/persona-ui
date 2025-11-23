"use client";

import type { FC } from "react";
import { RefreshCwIcon, PlusIcon, XIcon } from "lucide-react";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { cn } from "@/lib/utils";
import { useSessionHistory } from "@/app/MyRuntimeProvider";

const formatTimestamp = (isoString: string): string => {
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
      return "Unknown time";
    }
    return date.toLocaleString();
  } catch {
    return "Unknown time";
  }
};

type SessionSidebarProps = {
  mobileOpen?: boolean;
  onClose?: () => void;
};

export const SessionSidebar: FC<SessionSidebarProps> = ({
  mobileOpen = false,
  onClose,
}) => {
  const {
    sessions,
    isLoadingSessions,
    sessionsError,
    refreshSessions,
    openSession,
    startNewSession,
    activeSessionId,
  } = useSessionHistory();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex h-dvh w-72 max-w-[90vw] flex-col border border-border bg-card/95 shadow-xl shadow-black/10 transition-transform duration-200 ease-out backdrop-blur-md md:static md:h-full md:max-w-none md:border-r md:bg-card/30 md:shadow-none",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      )}
    >
      <div className="p-4 pb-2 flex items-center justify-between gap-3 border-b border-border/50">
        <div>
          <p className="text-sm font-semibold">Chats</p>
          <p className="text-xs text-muted-foreground">Resume a previous session</p>
        </div>
        <div className="flex gap-2">
          <TooltipIconButton
            tooltip="Refresh sessions"
            onClick={() => {
              void refreshSessions();
            }}
            className="size-8"
          >
            <RefreshCwIcon className="h-4 w-4" />
          </TooltipIconButton>
          <TooltipIconButton
            tooltip="Start new chat"
            onClick={startNewSession}
            className="size-8 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <PlusIcon className="h-4 w-4" />
          </TooltipIconButton>
          {onClose && (
            <button
              type="button"
              aria-label="Close sidebar"
              onClick={onClose}
              className="md:hidden inline-flex size-8 items-center justify-center rounded-md border border-border bg-background text-foreground transition hover:bg-muted"
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isLoadingSessions && (
          <p className="text-sm text-muted-foreground px-2 py-4">Loading chats…</p>
        )}
        {sessionsError && (
          <p className="text-sm text-red-500 px-2 py-2">{sessionsError}</p>
        )}
        {!isLoadingSessions && !sessions.length && !sessionsError && (
          <p className="text-sm text-muted-foreground px-2 py-4">
            No chats yet. Start a new conversation.
          </p>
        )}
        <ul className="space-y-1">
          {sessions.map((session) => {
            const isActive = session.sessionId === activeSessionId;
            return (
              <li key={session.sessionId}>
                <button
                  type="button"
                  onClick={() => {
                    void openSession(session.sessionId);
                    if (onClose) {
                      onClose();
                    }
                  }}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    isActive
                      ? "border-primary bg-primary/10"
                      : "border-transparent hover:border-border hover:bg-muted",
                  )}
                >
                  <p className="font-medium truncate">
                    Session {session.sessionId.slice(-6)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {session.personaName} · {formatTimestamp(session.updatedAt)}
                  </p>
                  {session.preview && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {session.preview}
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
};

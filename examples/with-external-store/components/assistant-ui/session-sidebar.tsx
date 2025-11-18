"use client";

import { RefreshCwIcon, PlusIcon } from "lucide-react";
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

export const SessionSidebar = () => {
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
    <aside className="w-72 border-r border-border bg-card/30 h-full flex flex-col">
      <div className="p-4 pb-2 flex items-center justify-between border-b border-border/50">
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
                    {session.characterName} · {formatTimestamp(session.updatedAt)}
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

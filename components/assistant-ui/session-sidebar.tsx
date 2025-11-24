"use client";

import { FC, useMemo, useState } from "react";
import { RefreshCwIcon, PlusIcon, XIcon, PinIcon } from "lucide-react";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { cn } from "@/lib/utils";
import { useSessionHistory } from "@/app/MyRuntimeProvider";

const safeTimestamp = (isoString: string): number => {
  const value = new Date(isoString).getTime();
  return Number.isNaN(value) ? 0 : value;
};

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
  const [isLocked, setIsLocked] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const isExpanded = mobileOpen || isLocked || isHovering;

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort(
        (a, b) => safeTimestamp(b.updatedAt) - safeTimestamp(a.updatedAt),
      ),
    [sessions],
  );

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex h-dvh w-72 max-w-[90vw] flex-col border-0 bg-transparent transition-transform duration-200 ease-out md:static md:h-full md:max-w-none",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="flex flex-1 flex-col gap-4 px-4 py-6 md:px-3">
        <div className="rounded-3xl border border-border/60 bg-card/90 p-4 shadow-xl shadow-black/5 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Chats
              </p>
              <p className="text-xs text-muted-foreground">Continue a conversation</p>
            </div>
            <div className="flex items-center gap-2">
              <TooltipIconButton
                tooltip="Refresh sessions"
                onClick={() => {
                  void refreshSessions();
                }}
                className="size-8 rounded-full border border-border/40 bg-background/80"
              >
                <RefreshCwIcon className="h-4 w-4" />
              </TooltipIconButton>
              <TooltipIconButton
                tooltip="Start new chat"
                onClick={startNewSession}
                className="size-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <PlusIcon className="h-4 w-4" />
              </TooltipIconButton>
              <TooltipIconButton
                tooltip={isLocked ? "Unlock panel" : "Lock panel"}
                onClick={() => setIsLocked((prev) => !prev)}
                className={cn(
                  "size-8 rounded-full border border-border/40 bg-background/80",
                  isLocked && "border-primary/40 bg-primary/10 text-primary",
                )}
              >
                <PinIcon className={cn("h-4 w-4 transition", isLocked && "-rotate-45")} />
              </TooltipIconButton>
              {onClose && (
                <button
                  type="button"
                  aria-label="Close sidebar"
                  onClick={onClose}
                  className="md:hidden inline-flex size-8 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm transition hover:bg-muted"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div
          className={cn(
            "transition-all duration-300",
            isExpanded ? "max-h-[70vh] opacity-100" : "pointer-events-none max-h-0 opacity-0",
          )}
          aria-hidden={!isExpanded}
        >
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1 pt-2">
            {isLoadingSessions && (
              <p className="text-sm text-muted-foreground px-2 py-2">Loading chats…</p>
            )}
            {sessionsError && (
              <p className="text-sm text-red-500 px-2 py-2">{sessionsError}</p>
            )}
            {!isLoadingSessions && !sessions.length && !sessionsError && (
              <p className="text-sm text-muted-foreground px-2 py-2">
                No chats yet. Start a new conversation.
              </p>
            )}
            <ul className="space-y-2">
              {sortedSessions.map((session, index) => {
                const isActive = session.sessionId === activeSessionId;
                const animationBaseDelay = 60;
                const animationCap = 8;
                const enterDelayMs = Math.min(index, animationCap) * animationBaseDelay;
                const exitDelayMs =
                  Math.min(sortedSessions.length - index - 1, animationCap) *
                  animationBaseDelay;
                const transitionDelay = `${isExpanded ? enterDelayMs : exitDelayMs}ms`;
                return (
                  <li
                    key={session.sessionId}
                    className={cn(
                      "transform-gpu transition-all duration-300 ease-out",
                      isExpanded
                        ? "opacity-100 translate-x-0"
                        : "opacity-0 -translate-x-3",
                    )}
                    style={{ transitionDelay }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        void openSession(session.sessionId);
                        if (onClose) {
                          onClose();
                        }
                      }}
                      className={cn(
                        "w-full rounded-2xl border px-4 py-3 text-left text-sm shadow-sm transition hover:shadow-md",
                        isActive
                          ? "border-primary/60 bg-primary/10 text-primary"
                          : "border-border/40 bg-background/80 hover:border-border/70",
                      )}
                    >
                      <p className="font-semibold tracking-wide text-xs text-muted-foreground uppercase">
                        Session {session.sessionId.slice(-6)}
                      </p>
                      <p className="text-sm font-medium text-foreground truncate">
                        {session.personaName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {formatTimestamp(session.updatedAt)}
                      </p>
                      {session.preview && (
                        <p className="text-xs text-muted-foreground/90 line-clamp-2 mt-2">
                          {session.preview}
                        </p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </aside>
  );
};

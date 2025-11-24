"use client";

import {
  ActionBarPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAssistantState,
} from "@assistant-ui/react";
import {
  createContext,
  FC,
  FormEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  CogIcon,
  Loader2Icon,
  CopyIcon,
  PlusIcon,
  PencilIcon,
  RefreshCwIcon,
  SendHorizontalIcon,
  SparklesIcon,
  BookOpenIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { usePersonaOptions, useReferences } from "@/app/MyRuntimeProvider";
import { resolveFastApiBaseUrl } from "@/lib/resolve-fastapi-url";
import {
  PersonaDocument,
  PersonaStudioManager,
} from "@/components/persona-studio/PersonaStudioManager";
import { ReferencesPanel } from "@/components/assistant-ui/references-panel";

type ReferencesSidebarContextValue = {
  openMessageId: string | null;
  toggleForMessage: (messageId: string) => void;
};

const ReferencesSidebarContext = createContext<ReferencesSidebarContextValue | null>(null);

const useReferencesSidebar = (): ReferencesSidebarContextValue => {
  const context = useContext(ReferencesSidebarContext);
  if (!context) {
    throw new Error("useReferencesSidebar must be used within ReferencesSidebarContext");
  }
  return context;
};

export const Thread: FC = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { referencesByMessageId } = useReferences();
  const [referenceSidebarMessageId, setReferenceSidebarMessageId] = useState<string | null>(null);

  const toggleReferencesForMessage = useCallback((messageId: string) => {
    setReferenceSidebarMessageId((current) => (current === messageId ? null : messageId));
  }, []);

  const referencesSidebarValue = useMemo(
    () => ({
      openMessageId: referenceSidebarMessageId,
      toggleForMessage: toggleReferencesForMessage,
    }),
    [referenceSidebarMessageId, toggleReferencesForMessage],
  );
  const resolvedReferenceMessageId =
    referenceSidebarMessageId && referencesByMessageId[referenceSidebarMessageId]
      ? referenceSidebarMessageId
      : null;
  const activeReferences = resolvedReferenceMessageId
    ? referencesByMessageId[resolvedReferenceMessageId] ?? []
    : [];
  const isReferencesPanelOpen = resolvedReferenceMessageId !== null;

  return (
    <ThreadPrimitive.Root
      className="bg-background box-border flex h-full min-h-0 flex-1 flex-col overflow-hidden"
      style={{
        ["--thread-max-width" as string]: "42rem",
      }}
    >
      <PersonaBubble onAdd={() => setIsAddModalOpen(true)} />
      <SettingsShortcut onOpen={() => setIsSettingsOpen(true)} />

      <ThreadPrimitive.Viewport className="flex-1 min-h-0 overflow-y-auto bg-inherit px-4 pb-40 pt-24">
        <div className="mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col">
          <ThreadWelcome />

          <ReferencesSidebarContext.Provider value={referencesSidebarValue}>
            <ThreadPrimitive.Messages
              components={{
                UserMessage: UserMessage,
                EditComposer: EditComposer,
                AssistantMessage: AssistantMessage,
              }}
            />
          </ReferencesSidebarContext.Provider>

          <ThreadPrimitive.If empty={false}>
            <div className="min-h-8" />
          </ThreadPrimitive.If>
        </div>
      </ThreadPrimitive.Viewport>

      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center px-4">
        <div className="pointer-events-auto relative w-full max-w-3xl">
          <ThreadScrollToBottom />
          <Composer />
        </div>
      </div>

      <AddPersonaModal open={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
      <PersonaSettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <ReferencesPanel
        open={isReferencesPanelOpen}
        onClose={() => setReferenceSidebarMessageId(null)}
        references={activeReferences}
        messageId={resolvedReferenceMessageId}
      />
    </ThreadPrimitive.Root>
  );
};

const PersonaBubble: FC<{ onAdd: () => void }> = ({ onAdd }) => {
  const {
    personas,
    selectedPersona,
    selectPersona,
    isLoadingPersonas,
    personasError,
  } = usePersonaOptions();

  const hasPersonas = personas.length > 0;
  const selectDisabled = isLoadingPersonas || !hasPersonas;
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [menuOpen]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-xl flex-col gap-1 rounded-full border border-border/70 bg-background/85 px-5 py-3 shadow-lg backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            <SparklesIcon className="h-3.5 w-3.5 text-amber-500" />
            Persona
          </div>
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1" ref={dropdownRef}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-full border border-border/50 bg-background/80 px-4 py-1.5 text-sm font-medium transition",
                  selectDisabled && "pointer-events-none opacity-60",
                )}
                aria-haspopup="listbox"
                aria-expanded={menuOpen}
                onClick={() => {
                  if (selectDisabled) return;
                  setMenuOpen((prev) => !prev);
                }}
              >
                <span className="truncate">
                  {selectedPersona?.displayName ?? (hasPersonas ? "Select a persona" : "No personas found")}
                </span>
                <ChevronDownIcon
                  className={cn(
                    "h-4 w-4 transition-transform",
                    menuOpen && "rotate-180",
                  )}
                />
              </button>
              {menuOpen && (
                <div className="absolute left-0 right-0 top-full z-10 mt-2 rounded-2xl border border-border/60 bg-background/95 shadow-2xl">
                  <div className="max-h-60 overflow-y-auto px-1 py-2">
                    {isLoadingPersonas ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">Loading personas…</p>
                    ) : !hasPersonas ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No personas available.</p>
                    ) : (
                      <ul role="listbox" className="space-y-1">
                        {personas.map((persona) => (
                          <li key={persona.id}>
                            <button
                              type="button"
                              className={cn(
                                "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition hover:bg-accent",
                                selectedPersona?.id === persona.id && "bg-accent text-accent-foreground",
                              )}
                              onClick={() => {
                                selectPersona(persona.id);
                                setMenuOpen(false);
                              }}
                            >
                              <span className="truncate">{persona.displayName}</span>
                              <span className="text-xs text-muted-foreground">
                                {persona.documentCount} doc{persona.documentCount === 1 ? "" : "s"}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
            {isLoadingPersonas && (
              <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full border-border/60"
              onClick={onAdd}
            >
              Add new
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingsShortcut: FC<{ onOpen: () => void }> = ({ onOpen }) => {
  return (
    <div className="fixed right-6 top-6 z-30">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="rounded-full border-border/70 bg-background/80 shadow-lg backdrop-blur"
        onClick={onOpen}
        aria-label="Open persona settings"
      >
        <CogIcon className="h-4 w-4" />
      </Button>
    </div>
  );
};

const AddPersonaModal: FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { refreshPersonas, selectPersona } = usePersonaOptions();
  const baseUrl = useMemo(() => resolveFastApiBaseUrl(), []);
  const [newPersonaName, setNewPersonaName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!open) {
      setNewPersonaName("");
      setFeedback(null);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = newPersonaName.trim();
    if (!trimmed) {
      setFeedback({ type: "error", message: "Enter a persona name first." });
      return;
    }
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const response = await fetch(`${baseUrl}/characters`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ display_name: trimmed }),
      });
      if (!response.ok) {
        throw new Error(`Failed to create persona (${response.status})`);
      }
      const payload: { id: string; display_name: string } = await response.json();
      setNewPersonaName("");
      await refreshPersonas();
      selectPersona(payload.id);
      setFeedback({ type: "success", message: `Created “${payload.display_name}”.` });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to create persona.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl border border-border/70 bg-background/95 p-6 shadow-2xl backdrop-blur"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Persona studio
            </p>
            <h3 className="text-2xl font-semibold">Add new persona</h3>
            <p className="text-sm text-muted-foreground">
              Give it a name and start chatting immediately.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={onClose}
            aria-label="Close add persona modal"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleCreate} className="mt-6 flex flex-col gap-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Persona name
          </label>
          <input
            type="text"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={newPersonaName}
            onChange={(event) => setNewPersonaName(event.target.value)}
            disabled={isSubmitting}
            placeholder="e.g. Pitch Whisperer"
            autoFocus
          />
          <Button type="submit" disabled={isSubmitting} className="gap-2">
            {isSubmitting ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <PlusIcon className="h-4 w-4" />}
            Create persona
          </Button>
        </form>

        {feedback && (
          <p
            className={cn(
              "mt-4 text-sm",
              feedback.type === "success" ? "text-green-500" : "text-red-500",
            )}
          >
            {feedback.message}
          </p>
        )}

        <div className="mt-4 text-sm text-muted-foreground">
          Need deeper control? Use the settings cog (top right) to fine-tune knowledge and documents.
        </div>
      </div>
    </div>
  );
};

const PersonaSettingsModal: FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { selectedPersona } = usePersonaOptions();
  const [viewingDocument, setViewingDocument] = useState<PersonaDocument | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [isViewerLoading, setIsViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);

  const isPreviewableDocument = useCallback((document: PersonaDocument) => {
    const previewableExtensions = ["pdf", "txt", "md", "markdown", "html", "htm"];
    const name = document.filename.toLowerCase();
    return previewableExtensions.some((extension) => name.endsWith(`.${extension}`));
  }, []);

  const resetViewer = useCallback(() => {
    setViewerUrl(null);
    setViewerError(null);
    setIsViewerLoading(false);
    setViewingDocument(null);
  }, []);

  const handleViewDocument = useCallback((document: PersonaDocument) => {
    setViewingDocument(document);
    if (!isPreviewableDocument(document)) {
      setViewerUrl(null);
      setIsViewerLoading(false);
      setViewerError("This file type can’t be previewed here. We’ll download it in a new tab.");
      if (typeof window !== "undefined") {
        window.open(document.download_url, "_blank", "noopener,noreferrer");
      }
      return;
    }

    setViewerError(null);
    setIsViewerLoading(true);
    const proxyUrl = `/api/document-preview?url=${encodeURIComponent(document.download_url)}&filename=${encodeURIComponent(document.filename)}`;
    setViewerUrl(proxyUrl);
  }, [isPreviewableDocument]);

  const handleIframeLoad = useCallback(() => {
    setIsViewerLoading(false);
  }, []);

  const handleIframeError = useCallback(() => {
    setViewerError("Unable to display document.");
    setIsViewerLoading(false);
  }, []);

  const handleClose = useCallback(() => {
    resetViewer();
    onClose();
  }, [onClose, resetViewer]);

  const isViewingDocument = viewingDocument !== null;
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4 py-6"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-6xl rounded-3xl border border-border/70 bg-background/95 shadow-2xl backdrop-blur"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <div className="flex items-center gap-3">
            {isViewingDocument && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full border border-border/40"
                onClick={resetViewer}
                aria-label="Back to settings"
              >
                <ArrowLeftIcon className="h-4 w-4" />
              </Button>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Persona studio
              </p>
              <h3 className="text-2xl font-semibold">
                {isViewingDocument ? "Document viewer" : "Settings"}
              </h3>
              {isViewingDocument && viewingDocument && (
                <p className="text-sm text-muted-foreground truncate">
                  {viewingDocument.filename}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={handleClose}
            aria-label="Close settings"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto px-1 pb-4">
          {isViewingDocument && viewingDocument ? (
            <div className="px-6 pb-6">
              <div className="relative rounded-2xl border border-border/70 bg-background/95 shadow-inner overflow-hidden">
                {viewerError ? (
                  <div className="flex h-[70vh] w-full items-center justify-center px-6 text-center text-sm text-red-500">
                    {viewerError}
                  </div>
                ) : (
                  viewerUrl && (
                    <iframe
                      key={viewerUrl}
                      src={viewerUrl}
                      title={viewingDocument.filename}
                      className="h-[70vh] w-full"
                      onLoad={handleIframeLoad}
                      onError={handleIframeError}
                    />
                  )
                )}
                {isViewerLoading && !viewerError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 text-sm text-muted-foreground">
                    Loading document…
                  </div>
                )}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Previewed locally. Use back to return to persona settings.
              </p>
            </div>
          ) : (
            <PersonaStudioManager
              className="px-6 pb-6"
              initialPersonaId={selectedPersona?.id ?? null}
              onViewDocument={handleViewDocument}
            />
          )}
        </div>
      </div>
    </div>
  );
};

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        variant="outline"
        className="absolute -top-10 right-4 rounded-full shadow-sm transition-opacity disabled:pointer-events-none disabled:opacity-0"
      >
        <ArrowDownIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

const ThreadWelcome: FC = () => {
  return (
    <ThreadPrimitive.Empty>
      <div className="flex w-full max-w-[var(--thread-max-width)] flex-grow flex-col">
        <div className="flex w-full flex-grow flex-col items-center justify-center">
          <p className="mt-4 font-medium">How can I help you today?</p>
        </div>
      </div>
    </ThreadPrimitive.Empty>
  );
};

const Composer: FC = () => {
  const { isLoadingPersonas, selectedPersona } = usePersonaOptions();
  const composerDisabled = isLoadingPersonas || !selectedPersona;
  const placeholder = isLoadingPersonas
    ? "Loading personas..."
    : !selectedPersona
      ? "Select a persona to start"
      : "Write a message...";

  return (
    <ComposerPrimitive.Root
      className="focus-within:ring-2 focus-within:ring-primary/20 flex w-full flex-wrap items-center gap-3 rounded-3xl border border-border/40 bg-background/95 px-5 py-3 shadow-xl shadow-black/10 transition-colors ease-in overflow-hidden backdrop-blur"
      data-disabled={composerDisabled || undefined}
    >
      <ComposerPrimitive.Input
        rows={1}
        autoFocus
        disabled={composerDisabled}
        placeholder={placeholder}
        className="placeholder:text-muted-foreground max-h-40 min-h-[2.75rem] w-full flex-1 resize-none border-none bg-transparent px-1 py-1 text-base leading-6 text-foreground outline-none focus:ring-0 disabled:cursor-not-allowed break-words whitespace-pre-wrap"
      />
      <ComposerAction disabled={composerDisabled} />
    </ComposerPrimitive.Root>
  );
};

const ComposerAction: FC<{ disabled?: boolean }> = ({ disabled }) => {
  return (
    <>
      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild>
          <TooltipIconButton
            tooltip="Send"
            variant="default"
            className="my-1.5 size-10 rounded-full border border-primary/30 bg-primary text-primary-foreground shadow-md transition-opacity ease-in hover:bg-primary/90"
            disabled={disabled}
          >
            <SendHorizontalIcon />
          </TooltipIconButton>
        </ComposerPrimitive.Send>
      </ThreadPrimitive.If>
      <ThreadPrimitive.If running>
        <ComposerPrimitive.Cancel asChild>
          <TooltipIconButton
            tooltip="Cancel"
            variant="default"
            className="my-1.5 size-10 rounded-full border border-destructive/30 bg-destructive/80 text-destructive-foreground shadow-md transition-opacity ease-in hover:bg-destructive"
          >
            <CircleStopIcon />
          </TooltipIconButton>
        </ComposerPrimitive.Cancel>
      </ThreadPrimitive.If>
    </>
  );
};

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root className="grid w-full max-w-[var(--thread-max-width)] auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] gap-y-2 py-4 [&:where(>*)]:col-start-2">
      <UserActionBar />

      <div className="bg-muted text-foreground col-start-2 row-start-2 max-w-[calc(var(--thread-max-width)*0.8)] rounded-3xl px-5 py-2.5 break-words">
        <MessagePrimitive.Parts />
      </div>
    </MessagePrimitive.Root>
  );
};

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="col-start-1 row-start-2 mt-2.5 mr-3 flex flex-col items-end"
    >
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton tooltip="Edit">
          <PencilIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  );
};

const EditComposer: FC = () => {
  return (
    <ComposerPrimitive.Root className="bg-muted my-4 flex w-full max-w-[var(--thread-max-width)] flex-col gap-2 rounded-xl">
      <ComposerPrimitive.Input className="text-foreground flex h-8 w-full resize-none bg-transparent p-4 pb-0 outline-none" />

      <div className="mx-3 mb-3 flex items-center justify-center gap-2 self-end">
        <ComposerPrimitive.Cancel asChild>
          <Button variant="ghost">Cancel</Button>
        </ComposerPrimitive.Cancel>
        <ComposerPrimitive.Send asChild>
          <Button>Send</Button>
        </ComposerPrimitive.Send>
      </div>
    </ComposerPrimitive.Root>
  );
};

const AssistantMessage: FC = () => {
  return (
    <MessagePrimitive.Root className="relative grid w-full max-w-[var(--thread-max-width)] grid-cols-[auto_auto_1fr] grid-rows-[auto_1fr] py-4">
      <div className="text-foreground col-span-2 col-start-2 row-start-1 my-1.5 max-w-[calc(var(--thread-max-width)*0.8)] leading-7 break-words">
        <MessagePrimitive.Parts components={{ Text: MarkdownText }} />
      </div>

      <AssistantActionBar />
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => {
  const messageId = useAssistantState((state) => state.message.id);
  const { referencesByMessageId } = useReferences();
  const { openMessageId, toggleForMessage } = useReferencesSidebar();
  const referenceCount = messageId ? referencesByMessageId[messageId]?.length ?? 0 : 0;
  const hasReferences = referenceCount > 0;
  const isReferencesOpen = hasReferences && messageId ? openMessageId === messageId : false;

  const handleToggle = () => {
    if (!messageId || !hasReferences) {
      return;
    }
    toggleForMessage(messageId);
  };

  return (
    <ActionBarPrimitive.Root
      autohide="not-last"
      autohideFloat="single-branch"
      className="text-muted-foreground data-[floating]:bg-background col-start-3 row-start-2 -ml-1 flex gap-1 data-[floating]:absolute data-[floating]:rounded-md data-[floating]:border data-[floating]:p-1 data-[floating]:shadow-sm"
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip="Copy">
          <MessagePrimitive.If copied>
            <CheckIcon />
          </MessagePrimitive.If>
          <MessagePrimitive.If copied={false}>
            <CopyIcon />
          </MessagePrimitive.If>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton tooltip="Refresh">
          <RefreshCwIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
      <div className="relative">
        <TooltipIconButton
          tooltip={isReferencesOpen ? "Hide references" : "Show references"}
          onClick={handleToggle}
          disabled={!hasReferences}
          aria-pressed={isReferencesOpen}
          className={cn(
            isReferencesOpen && "bg-primary/10 text-primary hover:bg-primary/10",
            !hasReferences && "opacity-60",
          )}
        >
          <BookOpenIcon className="h-4 w-4" />
        </TooltipIconButton>
        {hasReferences && (
          <span className="pointer-events-none absolute -right-1 -top-1 rounded-full bg-primary px-1.5 py-0 text-[0.6rem] font-semibold leading-[1.1] text-primary-foreground">
            {referenceCount > 9 ? "9+" : referenceCount}
          </span>
        )}
      </div>
    </ActionBarPrimitive.Root>
  );
};

const CircleStopIcon = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      width="16"
      height="16"
    >
      <rect width="10" height="10" x="3" y="3" rx="2" />
    </svg>
  );
};

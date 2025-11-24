"use client";

import {
  AppendMessage,
  AssistantRuntimeProvider,
  ThreadMessageLike,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import { resolveFastApiBaseUrl } from "@/lib/resolve-fastapi-url";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const convertMessage = (message: ThreadMessageLike) => {
  return message;
};

const createClientId = (fallbackPrefix: string) => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${fallbackPrefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createSessionId = () => createClientId("session");
const createMessageId = () => createClientId("msg");
const PERSONA_STORAGE_KEY = "chatbot.selectedPersona";
const LEGACY_CHARACTER_STORAGE_KEY = "chatbot.selectedCharacter";

const getStoredPersona = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const storedPersona = window.sessionStorage.getItem(PERSONA_STORAGE_KEY);
  if (storedPersona) {
    return storedPersona;
  }
  const legacy = window.sessionStorage.getItem(LEGACY_CHARACTER_STORAGE_KEY);
  if (legacy) {
    window.sessionStorage.setItem(PERSONA_STORAGE_KEY, legacy);
    window.sessionStorage.removeItem(LEGACY_CHARACTER_STORAGE_KEY);
    return legacy;
  }
  return null;
};

const persistPersona = (value: string | null) => {
  if (typeof window === "undefined") {
    return;
  }
  if (value) {
    window.sessionStorage.setItem(PERSONA_STORAGE_KEY, value);
  } else {
    window.sessionStorage.removeItem(PERSONA_STORAGE_KEY);
  }
};

const getMessageText = (message: ThreadMessageLike): string => {
  if (typeof message.content === "string") {
    return message.content;
  }

  const textPart = message.content.find((part) => part.type === "text");
  return textPart?.text ?? "";
};

type RunAssistantOptions = {
  userText: string;
  appendUserMessage?: boolean;
  assistantMessageId?: string;
  clearReferences?: boolean;
};

export type PersonaOption = {
  id: string;
  slug: string;
  displayName: string;
  documentCount: number;
};

type PersonaContextValue = {
  personas: readonly PersonaOption[];
  selectedPersona: PersonaOption | null;
  selectPersona: (personaId: string) => void;
  isLoadingPersonas: boolean;
  personasError: string | null;
  refreshPersonas: () => Promise<void>;
};

type SessionLogEntryModel = {
  timestamp: string;
  character_name: string;
  character_id?: string | null;
  character_slug?: string | null;
  user_message: string;
  assistant_response: string;
  references?: ReferenceItem[] | null;
  message_id?: string | null;
};

type SessionLogModel = {
  session_id: string;
  entries: SessionLogEntryModel[];
};

type SessionSummary = {
  sessionId: string;
  updatedAt: string;
  personaName: string;
  personaId: string | null;
  personaSlug: string | null;
  preview: string | null;
};

type SessionHistoryContextValue = {
  sessions: readonly SessionSummary[];
  isLoadingSessions: boolean;
  sessionsError: string | null;
  refreshSessions: () => Promise<void>;
  openSession: (sessionId: string) => Promise<void>;
  startNewSession: () => void;
  activeSessionId: string;
};

export type ReferenceItem = {
  source: string;
  excerpt: string;
  document?: string | null;
  metadata?: Record<string, any> | null;
};

type ReferenceContextValue = {
  referencesByMessageId: Record<string, ReferenceItem[]>;
};

const PersonaContext = createContext<PersonaContextValue | undefined>(undefined);
const SessionHistoryContext = createContext<SessionHistoryContextValue | undefined>(undefined);
const ReferencesContext = createContext<ReferenceContextValue | undefined>(undefined);
export const usePersonaOptions = (): PersonaContextValue => {
  const context = useContext(PersonaContext);
  if (!context) {
    throw new Error("usePersonaOptions must be used within MyRuntimeProvider");
  }
  return context;
};

export const useSessionHistory = (): SessionHistoryContextValue => {
  const context = useContext(SessionHistoryContext);
  if (!context) {
    throw new Error("useSessionHistory must be used within MyRuntimeProvider");
  }
  return context;
};

export const useReferences = (): ReferenceContextValue => {
  const context = useContext(ReferencesContext);
  if (!context) {
    throw new Error("useReferences must be used within MyRuntimeProvider");
  }
  return context;
};

export function MyRuntimeProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [messages, setMessages] = useState<readonly ThreadMessageLike[]>([]);
  const [sessionId, setSessionId] = useState<string>(() => createSessionId());
  const [isRunning, setIsRunning] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastAssistantMessageIdRef = useRef<string | null>(null);
  const [personas, setPersonas] = useState<readonly PersonaOption[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(
    () => getStoredPersona(),
  );
  const hasHydratedStoredPersonaRef = useRef(false);
  const [isLoadingPersonas, setIsLoadingPersonas] = useState<boolean>(true);
  const [personasError, setPersonasError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<readonly SessionSummary[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [referencesByMessageId, setReferencesByMessageId] = useState<Record<string, ReferenceItem[]>>({});
  const referencesStoreRef = useRef<Record<string, Record<string, ReferenceItem[]>>>({});
  const sessionMessagesRef = useRef<Record<string, readonly ThreadMessageLike[]>>({});

  useEffect(() => {
    sessionMessagesRef.current[sessionId] = messages;
  }, [messages, sessionId]);

  const ensureSessionStores = useCallback((targetSessionId: string) => {
    if (!sessionMessagesRef.current[targetSessionId]) {
      sessionMessagesRef.current[targetSessionId] = [];
    }
    if (!referencesStoreRef.current[targetSessionId]) {
      referencesStoreRef.current[targetSessionId] = {};
    }
  }, []);

  const applySessionMessageUpdate = useCallback(
    (
      targetSessionId: string,
      updater: (current: readonly ThreadMessageLike[]) => readonly ThreadMessageLike[],
    ) => {
      ensureSessionStores(targetSessionId);
      setMessages((currentMessages) => {
        if (targetSessionId !== sessionId) {
          const targetMessages = sessionMessagesRef.current[targetSessionId] ?? [];
          const nextMessages = updater(targetMessages);
          sessionMessagesRef.current[targetSessionId] = nextMessages;
          return currentMessages;
        }
        const nextMessages = updater(currentMessages);
        sessionMessagesRef.current[targetSessionId] = nextMessages;
        return nextMessages;
      });
    },
    [ensureSessionStores, sessionId],
  );

  const updateReferencesForSession = useCallback(
    (
      updater: (current: Record<string, ReferenceItem[]>) => Record<string, ReferenceItem[]>,
      targetSessionId?: string,
    ) => {
      const sessionKey = targetSessionId ?? sessionId;
      ensureSessionStores(sessionKey);
      setReferencesByMessageId((current) => {
        if (sessionKey !== sessionId) {
          const source = referencesStoreRef.current[sessionKey] ?? {};
          const next = updater(source);
          referencesStoreRef.current[sessionKey] = next;
          return current;
        }
        const next = updater(current);
        referencesStoreRef.current[sessionKey] = next;
        return next;
      });
    },
    [ensureSessionStores, sessionId],
  );

  useEffect(() => {
    ensureSessionStores(sessionId);
    setReferencesByMessageId(referencesStoreRef.current[sessionId]);
  }, [ensureSessionStores, sessionId]);

  const setAssistantText = useCallback(
    (
      messageId: string,
      nextText: string | ((currentText: string) => string),
      options?: { sessionId?: string },
    ) => {
      const targetSessionId = options?.sessionId ?? sessionId;
      applySessionMessageUpdate(targetSessionId, (currentMessages) =>
        currentMessages.map((message) => {
          if (message.id !== messageId) {
            return message;
          }

          const currentText = getMessageText(message);
          const resolvedText =
            typeof nextText === "function"
              ? (nextText as (text: string) => string)(currentText)
              : nextText;

          return {
            ...message,
            content: [{ type: "text", text: resolvedText }],
          } satisfies ThreadMessageLike;
        }),
      );
    },
    [applySessionMessageUpdate, sessionId],
  );

  const handleCancel = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (lastAssistantMessageIdRef.current) {
      const cancelledId = lastAssistantMessageIdRef.current;
      setAssistantText(cancelledId, (current) => {
        if (current.trim().length > 0) {
          return `${current}\n\nRequest canceled.`;
        }
        return "Request canceled.";
      });
    }

    setIsRunning(false);
  }, [setAssistantText]);

  const baseUrl = useMemo(() => resolveFastApiBaseUrl(), []);

  const refreshPersonas = useCallback(async () => {
    setIsLoadingPersonas(true);
    setPersonasError(null);
    try {
      const response = await fetch(`${baseUrl}/characters`);

      if (!response.ok) {
        throw new Error(`Failed to load personas (${response.status})`);
      }

      const payload: {
        characters?: Array<{
          id: string;
          slug: string;
          display_name: string;
          document_count: number;
        }>;
      } = await response.json();
      const nextPersonas: PersonaOption[] = Array.isArray(payload.characters)
        ? payload.characters.map((character) => ({
            id: character.id,
            slug: character.slug,
            displayName: character.display_name,
            documentCount: character.document_count,
          }))
        : [];
      if (!nextPersonas.length) {
        throw new Error("No personas available from the server");
      }

      setPersonas(nextPersonas);
      setSelectedPersonaId((current) => {
        const stored = getStoredPersona();
        if (stored && nextPersonas.some((persona) => persona.id === stored)) {
          return stored;
        }
        if (current && nextPersonas.some((persona) => persona.id === current)) {
          return current;
        }
        return nextPersonas[0]?.id ?? null;
      });
    } catch (error) {
      setPersonas([]);
      setSelectedPersonaId(null);
      persistPersona(null);
      setPersonasError(
        error instanceof Error ? error.message : "Unable to load personas.",
      );
    } finally {
      setIsLoadingPersonas(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    void refreshPersonas();
  }, [refreshPersonas]);

  const selectPersona = useCallback(
    (personaId: string) => {
      if (
        !personas.some((persona) => persona.id === personaId) ||
        personaId === selectedPersonaId
      ) {
        return;
      }

      void handleCancel();
      setMessages([]);
      const newSessionId = createSessionId();
  sessionMessagesRef.current[newSessionId] = [];
      referencesStoreRef.current[newSessionId] = {};
      setSessionId(newSessionId);
      lastAssistantMessageIdRef.current = null;

      setSelectedPersonaId(personaId);
      persistPersona(personaId);
    },
  [personas, handleCancel, selectedPersonaId],
  );

  useEffect(() => {
    if (!hasHydratedStoredPersonaRef.current) {
      if (selectedPersonaId === null) {
        return;
      }
      hasHydratedStoredPersonaRef.current = true;
    }
    persistPersona(selectedPersonaId);
  }, [selectedPersonaId]);

  const selectedPersona = useMemo(() => {
    if (!selectedPersonaId) {
      return null;
    }
    return personas.find((persona) => persona.id === selectedPersonaId) ?? null;
  }, [personas, selectedPersonaId]);

  const alignPersonaForSession = useCallback(
    (metadata: { personaId?: string | null; personaSlug?: string | null; personaName?: string | null }) => {
      if (!personas.length) {
        return;
      }
      const target = personas.find((persona) => {
        if (metadata.personaId && persona.id === metadata.personaId) {
          return true;
        }
        if (metadata.personaSlug && persona.slug === metadata.personaSlug) {
          return true;
        }
        if (metadata.personaName && persona.displayName.toLowerCase() === metadata.personaName.toLowerCase()) {
          return true;
        }
        return false;
      });
      if (target && target.id !== selectedPersonaId) {
        setSelectedPersonaId(target.id);
      }
    },
    [personas, selectedPersonaId],
  );

  const personaLookupById = useMemo(() => {
    const map = new Map<string, PersonaOption>();
    personas.forEach((persona) => {
      map.set(persona.id, persona);
    });
    return map;
  }, [personas]);

  const personaLookupBySlug = useMemo(() => {
    const map = new Map<string, PersonaOption>();
    personas.forEach((persona) => {
      map.set(persona.slug, persona);
    });
    return map;
  }, [personas]);

  const refreshSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    setSessionsError(null);
    try {
      const response = await fetch(`${baseUrl}/logs`);
      if (!response.ok) {
        throw new Error(`Failed to load logs (${response.status})`);
      }
      const payload: SessionLogModel[] = await response.json();
      const summaries: SessionSummary[] = payload.map((session) => {
        const latestEntry = session.entries[session.entries.length - 1];
        const previewText =
          latestEntry?.assistant_response?.trim() ||
          latestEntry?.user_message?.trim() ||
          null;
        const personaFromId = latestEntry?.character_id ? personaLookupById.get(latestEntry.character_id) : undefined;
        const personaFromSlug = !personaFromId && latestEntry?.character_slug
          ? personaLookupBySlug.get(latestEntry.character_slug)
          : undefined;
        const resolvedPersona = personaFromId ?? personaFromSlug;
        return {
          sessionId: session.session_id,
          updatedAt: latestEntry?.timestamp ?? new Date().toISOString(),
          personaName: resolvedPersona?.displayName ?? latestEntry?.character_name ?? "Unknown",
          personaId: resolvedPersona?.id ?? latestEntry?.character_id ?? null,
          personaSlug: resolvedPersona?.slug ?? latestEntry?.character_slug ?? null,
          preview: previewText,
        };
      });
      summaries.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      setSessions(summaries);
    } catch (error) {
      setSessionsError(
        error instanceof Error ? error.message : "Unable to load previous chats.",
      );
    } finally {
      setIsLoadingSessions(false);
    }
  }, [baseUrl, personaLookupById, personaLookupBySlug]);

  const buildMessagesFromSession = useCallback((session: SessionLogModel) => {
    const restored: ThreadMessageLike[] = [];
    const referenceMap: Record<string, ReferenceItem[]> = {};
    session.entries.forEach((entry) => {
      if (entry.user_message) {
        restored.push({
          id: createMessageId(),
          role: "user",
          content: [{ type: "text", text: entry.user_message }],
        });
      }
      if (entry.assistant_response) {
        const assistantMessageId = entry.message_id?.trim() ? entry.message_id : createMessageId();
        restored.push({
          id: assistantMessageId,
          role: "assistant",
          content: [{ type: "text", text: entry.assistant_response }],
        });
        if (Array.isArray(entry.references) && entry.references.length) {
          referenceMap[assistantMessageId] = entry.references.map((reference) => ({
            source: reference.source,
            excerpt: reference.excerpt,
            document: reference.document ?? null,
            metadata: reference.metadata ?? null,
          }));
        }
      }
    });
    return { messages: restored, references: referenceMap };
  }, []);

  const openSession = useCallback(
    async (targetSessionId: string) => {
      if (targetSessionId === sessionId) {
        return;
      }

      const cachedSummary = sessions.find((summary) => summary.sessionId === targetSessionId);
      if (cachedSummary) {
        alignPersonaForSession({
          personaId: cachedSummary.personaId,
          personaSlug: cachedSummary.personaSlug,
          personaName: cachedSummary.personaName,
        });
      }

      const cachedMessages = sessionMessagesRef.current[targetSessionId];
      if (cachedMessages) {
        const cachedReferences = referencesStoreRef.current[targetSessionId] ?? {};
        referencesStoreRef.current[targetSessionId] = cachedReferences;
        setSessionId(targetSessionId);
        setMessages(cachedMessages);
        setReferencesByMessageId(cachedReferences);
        return;
      }

      try {
        const response = await fetch(
          `${baseUrl}/logs?session_id=${encodeURIComponent(targetSessionId)}`,
        );
        if (!response.ok) {
          throw new Error(`Failed to load session ${targetSessionId}`);
        }
        const payload: SessionLogModel[] = await response.json();
        const session = payload[0];
        if (!session) {
          throw new Error("Session not found");
        }
        const metaEntry = session.entries[session.entries.length - 1] ?? session.entries[0];
        if (metaEntry) {
          alignPersonaForSession({
            personaId: metaEntry.character_id ?? null,
            personaSlug: metaEntry.character_slug ?? null,
            personaName: metaEntry.character_name ?? null,
          });
        }
        const { messages: restoredMessages, references: restoredReferences } = buildMessagesFromSession(
          session,
        );
        referencesStoreRef.current[targetSessionId] = restoredReferences;
        sessionMessagesRef.current[targetSessionId] = restoredMessages;
        setSessionId(targetSessionId);
        setMessages(restoredMessages);
        setReferencesByMessageId(restoredReferences);
      } catch (error) {
        console.error("Unable to open session", error);
        setSessionsError(
          error instanceof Error ? error.message : "Unable to open selected chat.",
        );
      }
    },
    [
      alignPersonaForSession,
      baseUrl,
      buildMessagesFromSession,
      sessionId,
      sessions,
      setReferencesByMessageId,
    ],
  );

  const startNewSession = useCallback(() => {
    void handleCancel();
    const newSessionId = createSessionId();
    sessionMessagesRef.current[newSessionId] = [];
    referencesStoreRef.current[newSessionId] = {};
    setSessionId(newSessionId);
    setMessages([]);
  }, [handleCancel]);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  const personaContextValue = useMemo<PersonaContextValue>(
    () => ({
      personas,
      selectedPersona,
      selectPersona,
      isLoadingPersonas,
      personasError,
      refreshPersonas,
    }),
    [
      personas,
      selectedPersona,
      selectPersona,
      isLoadingPersonas,
      personasError,
      refreshPersonas,
    ],
  );

  const sessionHistoryContextValue = useMemo<SessionHistoryContextValue>(
    () => ({
      sessions,
      isLoadingSessions,
      sessionsError,
      refreshSessions,
      openSession,
      startNewSession,
      activeSessionId: sessionId,
    }),
    [
      sessions,
      isLoadingSessions,
      sessionsError,
      refreshSessions,
      openSession,
      startNewSession,
      sessionId,
    ],
  );

  const referencesContextValue = useMemo<ReferenceContextValue>(
    () => ({
      referencesByMessageId,
    }),
    [referencesByMessageId],
  );

  const appendMessage = useCallback(
    (message: ThreadMessageLike, options?: { sessionId?: string }) => {
      const targetSessionId = options?.sessionId ?? sessionId;
      applySessionMessageUpdate(targetSessionId, (currentMessages) => [
        ...currentMessages,
        {
          ...message,
          id: message.id ?? createMessageId(),
        },
      ]);
    },
    [applySessionMessageUpdate, sessionId],
  );

  const runAssistant = useCallback(
    async ({
      userText,
      appendUserMessage = true,
      assistantMessageId,
      clearReferences = false,
    }: RunAssistantOptions) => {
      const text = userText.trim();
      if (!text) {
        return;
      }

      if (!selectedPersona) {
        console.warn("A persona must be selected before sending messages.");
        return;
      }

      const targetSessionId = sessionId;
      ensureSessionStores(targetSessionId);

      if (appendUserMessage) {
        appendMessage({
          id: createMessageId(),
          role: "user",
          content: [{ type: "text", text }],
        }, { sessionId: targetSessionId });
      }

      const resolvedAssistantMessageId = assistantMessageId ?? createMessageId();

      if (assistantMessageId) {
        setAssistantText(resolvedAssistantMessageId, "", { sessionId: targetSessionId });
      } else {
        appendMessage({
          id: resolvedAssistantMessageId,
          role: "assistant",
          content: [{ type: "text", text: "" }],
        }, { sessionId: targetSessionId });
      }

      if (clearReferences && assistantMessageId) {
        updateReferencesForSession((current) => {
          if (!current[assistantMessageId]) {
            return current;
          }
          const next = { ...current };
          delete next[assistantMessageId];
          return next;
        }, targetSessionId);
      }

      setIsRunning(true);
      const controller = new AbortController();
      abortControllerRef.current = controller;
      lastAssistantMessageIdRef.current = resolvedAssistantMessageId;

      try {
        const response = await fetch(`${baseUrl}/chat/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            message: text,
            session_id: targetSessionId,
            verbose: false,
            character_id: selectedPersona.id,
            response_message_id: resolvedAssistantMessageId,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Streaming response is missing a body reader.");
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let assembledText = "";
        let streamComplete = false;

        const processEvent = (rawEvent: string): boolean => {
          const dataLines = rawEvent
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim())
            .filter((line) => line.length > 0);

          for (const dataLine of dataLines) {
            let payload: any;
            try {
              payload = JSON.parse(dataLine);
            } catch (parseError) {
              console.warn("Unable to parse SSE payload", parseError);
              continue;
            }

            if (payload?.type === "delta" && typeof payload.content === "string") {
              assembledText += payload.content;
              setAssistantText(resolvedAssistantMessageId, assembledText, {
                sessionId: targetSessionId,
              });
            } else if (payload?.type === "error") {
              throw new Error(
                typeof payload.message === "string"
                  ? payload.message
                  : "Assistant streaming error",
              );
            } else if (payload?.type === "references") {
              const messageId = typeof payload.message_id === "string" ? payload.message_id : resolvedAssistantMessageId;
              const rawReferences = Array.isArray(payload.references) ? payload.references : [];
              if (messageId && rawReferences.length > 0) {
                const normalized = rawReferences
                  .map((entry: any): ReferenceItem | null => {
                    const excerpt = typeof entry?.excerpt === "string" ? entry.excerpt.trim() : "";
                    if (!excerpt) {
                      return null;
                    }
                    const source = typeof entry?.source === "string" ? entry.source : "Document";
                    const document = typeof entry?.document === "string" ? entry.document : null;
                    const metadata = entry?.metadata && typeof entry.metadata === "object" ? entry.metadata : null;
                    return { source, excerpt, document, metadata };
                  })
                  .filter((entry): entry is ReferenceItem => entry !== null);
                if (normalized.length > 0) {
                  updateReferencesForSession((current) => ({
                    ...current,
                    [messageId]: normalized,
                  }), targetSessionId);
                }
              }
            } else if (payload?.type === "done") {
              streamComplete = true;
              return true;
            }
          }

          return false;
        };

        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

          let delimiterIndex = buffer.indexOf("\n\n");
          while (delimiterIndex !== -1) {
            const rawEvent = buffer.slice(0, delimiterIndex).trim();
            buffer = buffer.slice(delimiterIndex + 2);
            if (rawEvent && processEvent(rawEvent)) {
              break;
            }
            delimiterIndex = buffer.indexOf("\n\n");
          }

          if (streamComplete) {
            break;
          }

          if (done) {
            const remaining = buffer.trim();
            if (remaining.length > 0) {
              processEvent(remaining);
            }
            break;
          }
        }

        const finalText = assembledText.trim().length > 0 ? assembledText.trim() : "(No response received.)";
        setAssistantText(resolvedAssistantMessageId, finalText, { sessionId: targetSessionId });
        void refreshSessions();
      } catch (error) {
        console.error("Failed to reach FastAPI backend", error);
        const isAbortError = error instanceof DOMException && error.name === "AbortError";
        if (!isAbortError) {
          setAssistantText(
            resolvedAssistantMessageId,
            "Sorry, I couldn’t reach the assistant service. Please try again.",
            { sessionId: targetSessionId },
          );
        }
      } finally {
        abortControllerRef.current = null;
        lastAssistantMessageIdRef.current = null;
        setIsRunning(false);
      }
    },
    [
      appendMessage,
      baseUrl,
      ensureSessionStores,
      refreshSessions,
      selectedPersona,
      sessionId,
      setAssistantText,
      updateReferencesForSession,
    ],
  );

  const onNew = useCallback(
    async (message: AppendMessage) => {
      const firstPart = message.content[0];
      if (!firstPart || firstPart.type !== "text") {
        throw new Error("Only plain text messages are supported.");
      }

      const text = firstPart.text.trim();
      if (!text) {
        return;
      }
      await runAssistant({ userText: text });
    },
    [runAssistant],
  );

  const handleReload = useCallback(
    async (parentId: string | null, config: { parentId: string | null; sourceId: string | null }) => {
      const assistantMessageId = config.sourceId;
      if (!assistantMessageId) {
        console.warn("Cannot retry assistant response without a target message id.");
        return;
      }

      let sourceText = "";
      if (parentId) {
        const parentMessage = messages.find((message) => message.id === parentId);
        if (parentMessage && parentMessage.role === "user") {
          sourceText = getMessageText(parentMessage);
        }
      }

      if (!sourceText) {
        const assistantIndex = messages.findIndex((message) => message.id === assistantMessageId);
        if (assistantIndex > 0) {
          const previousMessage = messages[assistantIndex - 1];
          if (previousMessage?.role === "user") {
            sourceText = getMessageText(previousMessage);
          }
        }
      }

      if (!sourceText.trim()) {
        console.warn("Unable to retry because the original user message could not be found.");
        return;
      }

      await runAssistant({
        userText: sourceText,
        appendUserMessage: false,
        assistantMessageId,
        clearReferences: true,
      });
    },
    [messages, runAssistant],
  );

  const runtime = useExternalStoreRuntime<ThreadMessageLike>({
    messages,
    setMessages,
    onNew,
    onCancel: handleCancel,
    onReload: handleReload,
    isRunning,
    convertMessage,
  });

  return (
    <PersonaContext.Provider value={personaContextValue}>
      <SessionHistoryContext.Provider value={sessionHistoryContextValue}>
        <ReferencesContext.Provider value={referencesContextValue}>
          <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>
        </ReferencesContext.Provider>
      </SessionHistoryContext.Provider>
    </PersonaContext.Provider>
  );
}

"use client";

import {
  AppendMessage,
  AssistantRuntimeProvider,
  ThreadMessageLike,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import { resolveFastApiBaseUrl } from "../lib/resolve-fastapi-url";
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
const CHARACTER_STORAGE_KEY = "chatbot.selectedCharacter";

const getStoredCharacter = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  return window.sessionStorage.getItem(CHARACTER_STORAGE_KEY);
};

const persistCharacter = (value: string | null) => {
  if (typeof window === "undefined") {
    return;
  }
  if (value) {
    window.sessionStorage.setItem(CHARACTER_STORAGE_KEY, value);
  } else {
    window.sessionStorage.removeItem(CHARACTER_STORAGE_KEY);
  }
};

const getMessageText = (message: ThreadMessageLike): string => {
  if (typeof message.content === "string") {
    return message.content;
  }

  const textPart = message.content.find((part) => part.type === "text");
  return textPart?.text ?? "";
};
 
export type CharacterOption = {
  id: string;
  slug: string;
  displayName: string;
  documentCount: number;
};

type CharacterContextValue = {
  characters: readonly CharacterOption[];
  selectedCharacter: CharacterOption | null;
  selectCharacter: (characterId: string) => void;
  isLoadingCharacters: boolean;
  charactersError: string | null;
};

type SessionLogEntryModel = {
  timestamp: string;
  character_name: string;
  user_message: string;
  assistant_response: string;
};

type SessionLogModel = {
  session_id: string;
  entries: SessionLogEntryModel[];
};

type SessionSummary = {
  sessionId: string;
  updatedAt: string;
  characterName: string;
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

const CharacterContext = createContext<CharacterContextValue | undefined>(undefined);
const SessionHistoryContext = createContext<SessionHistoryContextValue | undefined>(undefined);

export const useCharacterOptions = (): CharacterContextValue => {
  const context = useContext(CharacterContext);
  if (!context) {
    throw new Error("useCharacterOptions must be used within MyRuntimeProvider");
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
  const [characters, setCharacters] = useState<readonly CharacterOption[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    () => getStoredCharacter(),
  );
  const hasHydratedStoredCharacterRef = useRef(false);
  const [isLoadingCharacters, setIsLoadingCharacters] = useState<boolean>(true);
  const [charactersError, setCharactersError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<readonly SessionSummary[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const baseUrl = useMemo(() => resolveFastApiBaseUrl(), []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadCharacters = async () => {
      setIsLoadingCharacters(true);
      setCharactersError(null);
      try {
        const response = await fetch(`${baseUrl}/characters`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to load characters (${response.status})`);
        }

        const payload: {
          characters?: Array<{
            id: string;
            slug: string;
            display_name: string;
            document_count: number;
          }>;
        } = await response.json();
        const nextCharacters: CharacterOption[] = Array.isArray(payload.characters)
          ? payload.characters.map((character) => ({
              id: character.id,
              slug: character.slug,
              displayName: character.display_name,
              documentCount: character.document_count,
            }))
          : [];
        if (!nextCharacters.length) {
          throw new Error("No characters available from the server");
        }

        if (!cancelled) {
          setCharacters(nextCharacters);
          setSelectedCharacterId((current) => {
            const stored = getStoredCharacter();
            if (stored && nextCharacters.some((character) => character.id === stored)) {
              return stored;
            }
            if (current && nextCharacters.some((character) => character.id === current)) {
              return current;
            }
            return nextCharacters[0]?.id ?? null;
          });
        }
      } catch (error) {
        if (!cancelled) {
          setCharacters([]);
          setSelectedCharacterId(null);
          persistCharacter(null);
          setCharactersError(
            error instanceof Error ? error.message : "Unable to load characters.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCharacters(false);
        }
      }
    };

    void loadCharacters();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [baseUrl]);

  const selectCharacter = useCallback(
    (characterId: string) => {
      if (
        !characters.some((character) => character.id === characterId) ||
        characterId === selectedCharacterId
      ) {
        return;
      }
      setSelectedCharacterId(characterId);
      persistCharacter(characterId);
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    },
    [characters, selectedCharacterId],
  );

  useEffect(() => {
    if (!hasHydratedStoredCharacterRef.current) {
      if (selectedCharacterId === null) {
        return;
      }
      hasHydratedStoredCharacterRef.current = true;
    }
    persistCharacter(selectedCharacterId);
  }, [selectedCharacterId]);

  const selectedCharacter = useMemo(() => {
    if (!selectedCharacterId) {
      return null;
    }
    return characters.find((character) => character.id === selectedCharacterId) ?? null;
  }, [characters, selectedCharacterId]);

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
        return {
          sessionId: session.session_id,
          updatedAt: latestEntry?.timestamp ?? new Date().toISOString(),
          characterName: latestEntry?.character_name ?? "Unknown",
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
  }, [baseUrl]);

  const buildMessagesFromSession = useCallback((session: SessionLogModel) => {
    const restored: ThreadMessageLike[] = [];
    session.entries.forEach((entry) => {
      if (entry.user_message) {
        restored.push({
          id: createMessageId(),
          role: "user",
          content: [{ type: "text", text: entry.user_message }],
        });
      }
      if (entry.assistant_response) {
        restored.push({
          id: createMessageId(),
          role: "assistant",
          content: [{ type: "text", text: entry.assistant_response }],
        });
      }
    });
    return restored;
  }, []);

  const openSession = useCallback(
    async (targetSessionId: string) => {
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
        const restoredMessages = buildMessagesFromSession(session);
        setMessages(restoredMessages);
        setSessionId(targetSessionId);
      } catch (error) {
        console.error("Unable to open session", error);
        setSessionsError(
          error instanceof Error ? error.message : "Unable to open selected chat.",
        );
      }
    },
    [baseUrl, buildMessagesFromSession],
  );

  const startNewSession = useCallback(() => {
    setSessionId(createSessionId());
    setMessages([]);
  }, []);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  const characterContextValue = useMemo<CharacterContextValue>(
    () => ({
      characters,
      selectedCharacter,
      selectCharacter,
      isLoadingCharacters,
      charactersError,
    }),
    [characters, selectedCharacter, selectCharacter, isLoadingCharacters, charactersError],
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

  const appendMessage = useCallback(
    (message: ThreadMessageLike) => {
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          ...message,
          id: message.id ?? createMessageId(),
        },
      ]);
    },
    [],
  );

  const setAssistantText = useCallback((messageId: string, nextText: string | ((currentText: string) => string)) => {
    setMessages((currentMessages) =>
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
  }, []);

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

      if (!selectedCharacter) {
        console.warn("A character must be selected before sending messages.");
        return;
      }

      appendMessage({
        id: createMessageId(),
        role: "user",
        content: [{ type: "text", text }],
      });

      setIsRunning(true);

      const assistantMessageId = createMessageId();
      appendMessage({
        id: assistantMessageId,
        role: "assistant",
        content: [{ type: "text", text: "" }],
      });
      lastAssistantMessageIdRef.current = assistantMessageId;

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch(`${baseUrl}/chat/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            message: text,
            session_id: sessionId,
            verbose: false,
            character_id: selectedCharacter.id,
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
              setAssistantText(assistantMessageId, assembledText);
            } else if (payload?.type === "error") {
              throw new Error(
                typeof payload.message === "string"
                  ? payload.message
                  : "Assistant streaming error",
              );
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
        setAssistantText(assistantMessageId, finalText);
        void refreshSessions();
      } catch (error) {
        console.error("Failed to reach FastAPI backend", error);
        const isAbortError = error instanceof DOMException && error.name === "AbortError";
        if (!isAbortError) {
          setAssistantText(
            assistantMessageId,
            "Sorry, I couldn’t reach the assistant service. Please try again.",
          );
        }
      } finally {
        abortControllerRef.current = null;
        lastAssistantMessageIdRef.current = null;
        setIsRunning(false);
      }
    },
    [appendMessage, baseUrl, refreshSessions, selectedCharacter, sessionId, setAssistantText],
  );

  const runtime = useExternalStoreRuntime<ThreadMessageLike>({
    messages,
    setMessages,
    onNew,
    onCancel: handleCancel,
    isRunning,
    convertMessage,
  });

  return (
    <CharacterContext.Provider value={characterContextValue}>
      <SessionHistoryContext.Provider value={sessionHistoryContextValue}>
        <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>
      </SessionHistoryContext.Provider>
    </CharacterContext.Provider>
  );
}

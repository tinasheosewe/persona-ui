"use client";

import {
  AppendMessage,
  AssistantRuntimeProvider,
  ThreadMessageLike,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import { useCallback, useMemo, useRef, useState } from "react";

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

const getMessageText = (message: ThreadMessageLike): string => {
  if (typeof message.content === "string") {
    return message.content;
  }

  const textPart = message.content.find((part) => part.type === "text");
  return textPart?.text ?? "";
};

export function MyRuntimeProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [messages, setMessages] = useState<readonly ThreadMessageLike[]>([]);
  const [sessionId] = useState<string>(() => createSessionId());
  const [isRunning, setIsRunning] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastAssistantMessageIdRef = useRef<string | null>(null);

  const baseUrl = useMemo(() => {
    return process.env["NEXT_PUBLIC_FASTAPI_URL"] ?? "http://localhost:8000";
  }, []);

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
    [appendMessage, baseUrl, sessionId, setAssistantText],
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
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}

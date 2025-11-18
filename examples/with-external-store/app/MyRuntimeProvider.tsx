"use client";

import {
  AppendMessage,
  AssistantRuntimeProvider,
  ThreadMessageLike,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import { useCallback, useMemo, useState } from "react";

const convertMessage = (message: ThreadMessageLike) => {
  return message;
};

const createSessionId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

type FastAPIResponse = {
  session_id: string;
  response: string;
};

export function MyRuntimeProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [messages, setMessages] = useState<readonly ThreadMessageLike[]>([]);
  const [sessionId] = useState<string>(() => createSessionId());
  const [isRunning, setIsRunning] = useState(false);

  const baseUrl = useMemo(() => {
    return process.env["NEXT_PUBLIC_FASTAPI_URL"] ?? "http://localhost:8000";
  }, []);

  const appendMessage = useCallback(
    (message: ThreadMessageLike) => {
      setMessages((currentMessages) => [...currentMessages, message]);
    },
    [],
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

      appendMessage({
        role: "user",
        content: [{ type: "text", text }],
      });

      setIsRunning(true);

      try {
        const response = await fetch(`${baseUrl}/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: text,
            session_id: sessionId,
            verbose: false,
          }),
        });

        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`);
        }

        const data: FastAPIResponse = await response.json();

        appendMessage({
          role: "assistant",
          content: [{ type: "text", text: data.response.trim() }],
        });
      } catch (error) {
        console.error("Failed to reach FastAPI backend", error);
        appendMessage({
          role: "assistant",
          content: [
            {
              type: "text",
              text: "Sorry, I couldn’t reach the assistant service. Please try again.",
            },
          ],
        });
      } finally {
        setIsRunning(false);
      }
    },
    [appendMessage, baseUrl, sessionId],
  );

  const runtime = useExternalStoreRuntime<ThreadMessageLike>({
    messages,
    setMessages,
    onNew,
    isRunning,
    convertMessage,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}

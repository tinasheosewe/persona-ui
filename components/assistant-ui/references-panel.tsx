"use client";

import { FC } from "react";
import { XIcon } from "lucide-react";
import { ReferenceItem } from "@/app/MyRuntimeProvider";
import { Button } from "@/components/ui/button";

export type ReferencesPanelProps = {
  open: boolean;
  onClose: () => void;
  references: ReferenceItem[];
  messageId?: string | null;
};

export const ReferencesPanel: FC<ReferencesPanelProps> = ({
  open,
  onClose,
  references,
  messageId,
}) => {
  if (!open) {
    return null;
  }

  const truncatedId = messageId ? `${messageId.slice(0, 8)}…` : null;
  const hasReferences = references.length > 0;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative h-full w-full max-w-md bg-background shadow-2xl border-l border-border flex flex-col">
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">References</p>
            <h3 className="text-xl font-semibold">Raw lookup excerpts</h3>
            <p className="text-sm text-muted-foreground">
              These snippets come directly from retrieval and are not rewritten by the assistant.
            </p>
            {truncatedId && (
              <p className="mt-2 text-xs text-muted-foreground/80">Reply ID {truncatedId}</p>
            )}
          </div>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={onClose} aria-label="Close references panel">
            <XIcon className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!hasReferences ? (
            <p className="text-sm text-muted-foreground">
              No references available for this reply yet.
            </p>
          ) : (
            references.map((reference, index) => (
              <article key={`${messageId ?? "reference"}-${index}`} className="rounded-xl border border-border/80 bg-card/60 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                  <span className="font-semibold">{reference.source || "Document"}</span>
                  {reference.document && (
                    <span className="truncate text-[0.65rem] text-muted-foreground/90">{reference.document}</span>
                  )}
                </div>
                <blockquote className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                  {reference.excerpt}
                </blockquote>
                {reference.metadata && Object.keys(reference.metadata).length > 0 && (
                  <div className="text-[0.7rem] text-muted-foreground">
                    {Object.entries(reference.metadata).map(([key, value]) => (
                      <div key={key} className="flex gap-1">
                        <span className="uppercase tracking-wide">{key}:</span>
                        <span className="truncate">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))
          )}
        </div>

        <div className="border-t border-border/70 px-5 py-4 text-xs text-muted-foreground">
          Raw excerpts are shown as-is from the knowledge base and are never fed back into the answering model, reducing hallucination risk.
        </div>
      </div>
    </div>
  );
};

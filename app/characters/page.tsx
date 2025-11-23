"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ExternalLinkIcon,
  Loader2Icon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";

import { resolveFastApiBaseUrl } from "@/lib/resolve-fastapi-url";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CharacterDocument {
  filename: string;
  size_bytes: number;
  updated_at: string;
  download_url: string;
}

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

const formatTimestamp = (iso: string): string => {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "Unknown";
    return date.toLocaleString();
  } catch {
    return "Unknown";
  }
};

export default function CharacterManagerPage() {
  const baseUrl = useMemo(() => resolveFastApiBaseUrl(), []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [characters, setCharacters] = useState<string[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [isLoadingCharacters, setIsLoadingCharacters] = useState<boolean>(true);
  const [charactersError, setCharactersError] = useState<string | null>(null);

  const [documents, setDocuments] = useState<CharacterDocument[]>([]);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadCharacters = useCallback(async () => {
    setIsLoadingCharacters(true);
    setCharactersError(null);
    try {
      const response = await fetch(`${baseUrl}/characters`);
      if (!response.ok) {
        throw new Error(`Failed to load characters (${response.status})`);
      }
      const payload = (await response.json()) as { characters?: string[] };
      const nextCharacters = Array.isArray(payload.characters)
        ? payload.characters
        : [];
      setCharacters(nextCharacters);
      setSelectedCharacter((current) => {
        if (current && nextCharacters.includes(current)) {
          return current;
        }
        return nextCharacters[0] ?? null;
      });
    } catch (error) {
      setCharactersError(
        error instanceof Error ? error.message : "Unable to load characters.",
      );
      setCharacters([]);
      setSelectedCharacter(null);
    } finally {
      setIsLoadingCharacters(false);
    }
  }, [baseUrl]);

  const loadDocuments = useCallback(async () => {
    if (!selectedCharacter) {
      setDocuments([]);
      return;
    }
    setIsLoadingDocuments(true);
    setDocumentsError(null);
    setSuccessMessage(null);
    try {
      const encodedName = encodeURIComponent(selectedCharacter);
      const response = await fetch(
        `${baseUrl}/characters/${encodedName}/documents`,
      );
      if (!response.ok) {
        throw new Error(`Failed to load documents (${response.status})`);
      }
      const payload = (await response.json()) as {
        documents?: CharacterDocument[];
      };
      setDocuments(Array.isArray(payload.documents) ? payload.documents : []);
    } catch (error) {
      setDocumentsError(
        error instanceof Error ? error.message : "Unable to load documents.",
      );
      setDocuments([]);
    } finally {
      setIsLoadingDocuments(false);
    }
  }, [baseUrl, selectedCharacter]);

  useEffect(() => {
    void loadCharacters();
  }, [loadCharacters]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const handleFileSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedCharacter) {
      return;
    }
    setIsUploading(true);
    setDocumentsError(null);
    setSuccessMessage(null);
    try {
      const encodedName = encodeURIComponent(selectedCharacter);
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(
        `${baseUrl}/characters/${encodedName}/documents`,
        {
          method: "POST",
          body: formData,
        },
      );
      if (!response.ok) {
        throw new Error(`Upload failed (${response.status})`);
      }
      setSuccessMessage(
        `Uploaded “${file.name}”. Vectorization completed successfully.`,
      );
      await loadDocuments();
    } catch (error) {
      setDocumentsError(
        error instanceof Error ? error.message : "File upload failed.",
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (filename: string) => {
    if (!selectedCharacter) {
      return;
    }
    const confirmed = window.confirm(
      `Remove “${filename}” from ${selectedCharacter}? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }
    setDocumentsError(null);
    setSuccessMessage(null);
    try {
      const encodedName = encodeURIComponent(selectedCharacter);
      const encodedFile = encodeURIComponent(filename);
      const response = await fetch(
        `${baseUrl}/characters/${encodedName}/documents/${encodedFile}`,
        {
          method: "DELETE",
        },
      );
      if (response.status !== 204) {
        throw new Error(`Failed to delete document (${response.status})`);
      }
      await loadDocuments();
    } catch (error) {
      setDocumentsError(
        error instanceof Error ? error.message : "Unable to delete document.",
      );
    }
  };

  const handleOpen = (document: CharacterDocument) => {
    window.open(document.download_url, "_blank", "noopener,noreferrer");
  };

  const disabled = isLoadingCharacters || characters.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <section className="rounded-lg border border-border bg-card/70 p-5 shadow-sm">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Character documents
              </p>
              <h1 className="text-2xl font-semibold">Manage your knowledge base</h1>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadCharacters()}
              disabled={isLoadingCharacters}
              className="gap-1"
            >
              <RefreshCwIcon
                className={cn("h-4 w-4", isLoadingCharacters && "animate-spin")}
              />
              Refresh
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Upload, review, or remove the source documents attached to each character.
            New uploads trigger a full vector rebuild and are available in chat once that completes.
          </p>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Character
            </label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60"
              value={selectedCharacter ?? ""}
              onChange={(event) => setSelectedCharacter(event.target.value)}
              disabled={disabled}
            >
              <option value="" disabled>
                {isLoadingCharacters
                  ? "Loading characters..."
                  : characters.length
                    ? "Select a character"
                    : "No characters found"}
              </option>
              {characters.map((character) => (
                <option key={character} value={character}>
                  {character}
                </option>
              ))}
            </select>
            {charactersError && (
              <p className="text-xs text-red-500">{charactersError}</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Upload document
            </label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                className="flex-1 text-sm"
                onChange={handleFileSelection}
                disabled={disabled || isUploading}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Supported types: .txt, .pdf, .docx, .epub and more via Unstructured processors.
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {isUploading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="h-4 w-4 animate-spin" />
              Uploading and vectorizing document… this may take a moment.
            </p>
          )}
          {successMessage && (
            <p className="text-sm text-green-600">{successMessage}</p>
          )}
          {documentsError && (
            <p className="text-sm text-red-500">{documentsError}</p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card/70 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Documents</h2>
          {selectedCharacter && (
            <p className="text-sm text-muted-foreground">
              {documents.length} file{documents.length === 1 ? "" : "s"} linked to {selectedCharacter}
            </p>
          )}
        </div>
        {isLoadingDocuments ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2Icon className="h-4 w-4 animate-spin" />
            Loading documents…
          </div>
        ) : !documents.length ? (
          <p className="py-6 text-sm text-muted-foreground">
            {selectedCharacter
              ? "No documents found for this character."
              : "Select a character to view documents."}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2">Filename</th>
                  <th className="py-2">Size</th>
                  <th className="py-2">Updated</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr
                    key={document.filename}
                    className="border-t border-border/50 text-sm"
                  >
                    <td className="py-3 font-medium">{document.filename}</td>
                    <td>{formatSize(document.size_bytes)}</td>
                    <td>{formatTimestamp(document.updated_at)}</td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpen(document)}
                        >
                          <ExternalLinkIcon className="h-4 w-4" />
                          Open
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(document.filename)}
                        >
                          <Trash2Icon className="h-4 w-4" />
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ExternalLinkIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";

import { resolveFastApiBaseUrl } from "@/lib/resolve-fastapi-url";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CharacterSummary {
  id: string;
  slug: string;
  display_name: string;
  document_count: number;
}

interface CharacterDocument {
  filename: string;
  relative_path: string;
  size_bytes: number;
  updated_at: string;
  download_url: string;
}

const encodeDocumentPath = (relativePath: string): string =>
  relativePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

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

  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [isLoadingCharacters, setIsLoadingCharacters] = useState<boolean>(true);
  const [charactersError, setCharactersError] = useState<string | null>(null);
  const [characterActionError, setCharacterActionError] = useState<string | null>(null);
  const [characterActionMessage, setCharacterActionMessage] = useState<string | null>(null);
  const [newCharacterName, setNewCharacterName] = useState<string>("");
  const [isSubmittingCharacter, setIsSubmittingCharacter] = useState<boolean>(false);

  const [documents, setDocuments] = useState<CharacterDocument[]>([]);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedCharacter = useMemo(() => {
    if (!selectedCharacterId) {
      return null;
    }
    return characters.find((character) => character.id === selectedCharacterId) ?? null;
  }, [characters, selectedCharacterId]);

  const loadCharacters = useCallback(async () => {
    setIsLoadingCharacters(true);
    setCharactersError(null);
    try {
      const response = await fetch(`${baseUrl}/characters`);
      if (!response.ok) {
        throw new Error(`Failed to load characters (${response.status})`);
      }
      const payload = (await response.json()) as { characters?: CharacterSummary[] };
      const nextCharacters = Array.isArray(payload.characters)
        ? payload.characters
        : [];
      setCharacters(nextCharacters);
      setSelectedCharacterId((current) => {
        if (current && nextCharacters.some((entry) => entry.id === current)) {
          return current;
        }
        return nextCharacters[0]?.id ?? null;
      });
    } catch (error) {
      setCharactersError(
        error instanceof Error ? error.message : "Unable to load characters.",
      );
      setCharacters([]);
      setSelectedCharacterId(null);
    } finally {
      setIsLoadingCharacters(false);
    }
  }, [baseUrl]);

  const handleRefreshCharacters = useCallback(() => {
    setCharacterActionMessage(null);
    setCharacterActionError(null);
    void loadCharacters();
  }, [loadCharacters]);

  const loadDocuments = useCallback(async () => {
    if (!selectedCharacter) {
      setDocuments([]);
      return;
    }
    setIsLoadingDocuments(true);
    setDocumentsError(null);
    setSuccessMessage(null);
    try {
      const encodedSlug = encodeURIComponent(selectedCharacter.slug);
      const response = await fetch(
        `${baseUrl}/characters/${encodedSlug}/documents`,
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
      const encodedSlug = encodeURIComponent(selectedCharacter.slug);
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(
        `${baseUrl}/characters/${encodedSlug}/documents`,
        {
          method: "POST",
          body: formData,
        },
      );
      if (!response.ok) {
        throw new Error(`Upload failed (${response.status})`);
      }
      const payload = (await response.json()) as {
        document?: CharacterDocument;
      };
      const uploadedPath = payload.document?.relative_path ?? file.name;
      setSuccessMessage(
        `Uploaded “${uploadedPath}”. Vectorization completed successfully.`,
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

  const handleDelete = async (relativePath: string) => {
    if (!selectedCharacter) {
      return;
    }
    const confirmed = window.confirm(
      `Remove “${relativePath}” from ${selectedCharacter.display_name}? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }
    setDocumentsError(null);
    setSuccessMessage(null);
    try {
      const encodedSlug = encodeURIComponent(selectedCharacter.slug);
  const encodedFile = encodeDocumentPath(relativePath);
      const response = await fetch(
        `${baseUrl}/characters/${encodedSlug}/documents/${encodedFile}`,
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

  const handleCreateCharacter = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = newCharacterName.trim();
    if (!value) {
      return;
    }
    setIsSubmittingCharacter(true);
    setCharacterActionError(null);
    setCharacterActionMessage(null);
    try {
      const response = await fetch(`${baseUrl}/characters`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ display_name: value }),
      });
      if (!response.ok) {
        throw new Error(`Failed to create character (${response.status})`);
      }
      const payload = (await response.json()) as CharacterSummary;
      setCharacterActionMessage(`Created “${payload.display_name}”.`);
      setNewCharacterName("");
      await loadCharacters();
    } catch (error) {
      setCharacterActionError(
        error instanceof Error ? error.message : "Unable to create character.",
      );
    } finally {
      setIsSubmittingCharacter(false);
    }
  };

  const handleRenameCharacter = async (character: CharacterSummary) => {
    const nextName = window
      .prompt(`Rename ${character.display_name}`, character.display_name)
      ?.trim();
    if (!nextName || nextName === character.display_name) {
      return;
    }
    setCharacterActionError(null);
    setCharacterActionMessage(null);
    try {
      const response = await fetch(`${baseUrl}/characters/${character.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ display_name: nextName }),
      });
      if (!response.ok) {
        throw new Error(`Failed to rename character (${response.status})`);
      }
      const payload = (await response.json()) as CharacterSummary;
      setCharacterActionMessage(`Renamed character to “${payload.display_name}”.`);
      await loadCharacters();
    } catch (error) {
      setCharacterActionError(
        error instanceof Error ? error.message : "Unable to rename character.",
      );
    }
  };

  const handleDeleteCharacter = async (character: CharacterSummary) => {
    const confirmed = window.confirm(
      `Delete ${character.display_name}? This will remove all documents and vector stores.`,
    );
    if (!confirmed) {
      return;
    }
    setCharacterActionError(null);
    setCharacterActionMessage(null);
    try {
      const response = await fetch(`${baseUrl}/characters/${character.id}`, {
        method: "DELETE",
      });
      if (response.status !== 204) {
        throw new Error(`Failed to delete character (${response.status})`);
      }
      setCharacterActionMessage(`Deleted ${character.display_name}.`);
      await loadCharacters();
    } catch (error) {
      setCharacterActionError(
        error instanceof Error ? error.message : "Unable to delete character.",
      );
    }
  };

  const disabled = isLoadingCharacters || characters.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <section className="rounded-lg border border-border bg-card/70 p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Character roster
            </p>
            <h1 className="text-2xl font-semibold">Manage personas</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Create, rename, or delete characters. Deleting a character permanently removes its documents and vector store.
            </p>
          </div>
          <form className="flex flex-col gap-2 md:w-80" onSubmit={handleCreateCharacter}>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Add new character
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                placeholder="e.g. Aria Stark"
                value={newCharacterName}
                onChange={(event) => setNewCharacterName(event.target.value)}
                disabled={isSubmittingCharacter || isLoadingCharacters}
              />
              <Button type="submit" disabled={isSubmittingCharacter || isLoadingCharacters} className="gap-1">
                {isSubmittingCharacter ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <PlusIcon className="h-4 w-4" />}
                Add
              </Button>
            </div>
          </form>
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2">Name</th>
                <th className="py-2">Slug</th>
                <th className="py-2">Documents</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingCharacters ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-muted-foreground">
                    <Loader2Icon className="inline h-4 w-4 animate-spin" /> Loading characters…
                  </td>
                </tr>
              ) : !characters.length ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-muted-foreground">
                    No characters available.
                  </td>
                </tr>
              ) : (
                characters.map((character) => (
                  <tr key={character.id} className="border-t border-border/50">
                    <td className="py-3 font-medium">{character.display_name}</td>
                    <td className="py-3 text-muted-foreground">{character.slug}</td>
                    <td className="py-3">{character.document_count}</td>
                    <td className="py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRenameCharacter(character)}
                          className="gap-1"
                        >
                          <PencilIcon className="h-4 w-4" /> Rename
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteCharacter(character)}
                          className="gap-1"
                        >
                          <Trash2Icon className="h-4 w-4" /> Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {(characterActionMessage || characterActionError || charactersError) && (
          <div className="mt-4 space-y-1 text-sm">
            {characterActionMessage && <p className="text-green-600">{characterActionMessage}</p>}
            {characterActionError && <p className="text-red-500">{characterActionError}</p>}
            {charactersError && <p className="text-red-500">{charactersError}</p>}
          </div>
        )}
      </section>

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
              onClick={handleRefreshCharacters}
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
              value={selectedCharacterId ?? ""}
              onChange={(event) => setSelectedCharacterId(event.target.value)}
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
                <option key={character.id} value={character.id}>
                  {character.display_name}
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
              {documents.length} file{documents.length === 1 ? "" : "s"} linked to {selectedCharacter.display_name}
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
                    key={document.relative_path}
                    className="border-t border-border/50 text-sm"
                  >
                    <td className="py-3">
                      <p className="font-medium">{document.filename}</p>
                      {document.relative_path !== document.filename && (
                        <p className="text-xs text-muted-foreground">
                          {document.relative_path}
                        </p>
                      )}
                    </td>
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
                          onClick={() => handleDelete(document.relative_path)}
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

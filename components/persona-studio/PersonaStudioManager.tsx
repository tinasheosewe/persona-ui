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

interface PersonaSummary {
  id: string;
  slug: string;
  display_name: string;
  document_count: number;
}

export interface PersonaDocument {
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

type PersonaStudioManagerProps = {
  className?: string;
  initialPersonaId?: string | null;
  onViewDocument?: (document: PersonaDocument) => void;
};

export function PersonaStudioManager({
  className,
  initialPersonaId,
  onViewDocument,
}: PersonaStudioManagerProps) {
  const baseUrl = useMemo(() => resolveFastApiBaseUrl(), []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [personas, setPersonas] = useState<PersonaSummary[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(
    initialPersonaId ?? null,
  );
  const [isLoadingPersonas, setIsLoadingPersonas] = useState<boolean>(true);
  const [personasError, setPersonasError] = useState<string | null>(null);
  const [personaActionError, setPersonaActionError] = useState<string | null>(null);
  const [personaActionMessage, setPersonaActionMessage] = useState<string | null>(null);
  const [newPersonaName, setNewPersonaName] = useState<string>("");
  const [isSubmittingPersona, setIsSubmittingPersona] = useState<boolean>(false);

  const [documents, setDocuments] = useState<PersonaDocument[]>([]);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedPersona = useMemo(() => {
    if (!selectedPersonaId) {
      return null;
    }
    return personas.find((persona) => persona.id === selectedPersonaId) ?? null;
  }, [personas, selectedPersonaId]);

  useEffect(() => {
    setSelectedPersonaId(initialPersonaId ?? null);
  }, [initialPersonaId]);

  const loadPersonas = useCallback(async () => {
    setIsLoadingPersonas(true);
    setPersonasError(null);
    try {
      const response = await fetch(`${baseUrl}/characters`);
      if (!response.ok) {
        throw new Error(`Failed to load characters (${response.status})`);
      }
      const payload = (await response.json()) as { characters?: PersonaSummary[] };
      const nextPersonas = Array.isArray(payload.characters) ? payload.characters : [];
      setPersonas(nextPersonas);
      setSelectedPersonaId((current) => {
        if (current && nextPersonas.some((entry) => entry.id === current)) {
          return current;
        }
        return nextPersonas[0]?.id ?? null;
      });
    } catch (error) {
      setPersonasError(
        error instanceof Error ? error.message : "Unable to load characters.",
      );
      setPersonas([]);
      setSelectedPersonaId(null);
    } finally {
      setIsLoadingPersonas(false);
    }
  }, [baseUrl]);

  const handleRefreshPersonas = useCallback(() => {
    setPersonaActionMessage(null);
    setPersonaActionError(null);
    void loadPersonas();
  }, [loadPersonas]);

  const loadDocuments = useCallback(async () => {
    if (!selectedPersona) {
      setDocuments([]);
      return;
    }
    setIsLoadingDocuments(true);
    setDocumentsError(null);
    setSuccessMessage(null);
    try {
      const encodedSlug = encodeURIComponent(selectedPersona.slug);
      const response = await fetch(`${baseUrl}/characters/${encodedSlug}/documents`);
      if (!response.ok) {
        throw new Error(`Failed to load documents (${response.status})`);
      }
      const payload = (await response.json()) as {
        documents?: PersonaDocument[];
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
  }, [baseUrl, selectedPersona]);

  useEffect(() => {
    void loadPersonas();
  }, [loadPersonas]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const handleFileSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedPersona) {
      return;
    }
    setIsUploading(true);
    setDocumentsError(null);
    setSuccessMessage(null);
    try {
      const encodedSlug = encodeURIComponent(selectedPersona.slug);
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${baseUrl}/characters/${encodedSlug}/documents`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`Upload failed (${response.status})`);
      }
      const payload = (await response.json()) as {
        document?: PersonaDocument;
      };
      const uploadedPath = payload.document?.relative_path ?? file.name;
      setSuccessMessage(`Uploaded “${uploadedPath}”. Vectorization completed successfully.`);
      await loadDocuments();
    } catch (error) {
      setDocumentsError(error instanceof Error ? error.message : "File upload failed.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (relativePath: string) => {
    if (!selectedPersona) {
      return;
    }
    const confirmed = window.confirm(
      `Remove “${relativePath}” from ${selectedPersona.display_name}? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }
    setDocumentsError(null);
    setSuccessMessage(null);
    try {
      const encodedSlug = encodeURIComponent(selectedPersona.slug);
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

  const handleCreatePersona = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = newPersonaName.trim();
    if (!value) {
      return;
    }
    setIsSubmittingPersona(true);
    setPersonaActionError(null);
    setPersonaActionMessage(null);
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
      const payload = (await response.json()) as PersonaSummary;
      setPersonaActionMessage(`Created “${payload.display_name}”.`);
      setNewPersonaName("");
      await loadPersonas();
    } catch (error) {
      setPersonaActionError(
        error instanceof Error ? error.message : "Unable to create character.",
      );
    } finally {
      setIsSubmittingPersona(false);
    }
  };

  const handleRenamePersona = async (persona: PersonaSummary) => {
    const nextName = window
      .prompt(`Rename ${persona.display_name}`, persona.display_name)
      ?.trim();
    if (!nextName || nextName === persona.display_name) {
      return;
    }
    setPersonaActionError(null);
    setPersonaActionMessage(null);
    try {
      const response = await fetch(`${baseUrl}/characters/${persona.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ display_name: nextName }),
      });
      if (!response.ok) {
        throw new Error(`Failed to rename character (${response.status})`);
      }
      const payload = (await response.json()) as PersonaSummary;
      setPersonaActionMessage(`Renamed persona to “${payload.display_name}”.`);
      await loadPersonas();
    } catch (error) {
      setPersonaActionError(
        error instanceof Error ? error.message : "Unable to rename character.",
      );
    }
  };

  const handleDeletePersona = async (persona: PersonaSummary) => {
    const confirmed = window.confirm(
      `Delete ${persona.display_name}? This will remove all documents and vector stores.`,
    );
    if (!confirmed) {
      return;
    }
    setPersonaActionError(null);
    setPersonaActionMessage(null);
    try {
      const response = await fetch(`${baseUrl}/characters/${persona.id}`, {
        method: "DELETE",
      });
      if (response.status !== 204) {
        throw new Error(`Failed to delete character (${response.status})`);
      }
      setPersonaActionMessage(`Deleted ${persona.display_name}.`);
      await loadPersonas();
    } catch (error) {
      setPersonaActionError(
        error instanceof Error ? error.message : "Unable to delete character.",
      );
    }
  };

  return (
    <div
      className={cn(
        "mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col gap-6 px-4 py-6 lg:overflow-hidden",
        className,
      )}
    >
      <div className="flex flex-col gap-6 lg:flex-1 lg:min-h-0 lg:grid lg:grid-cols-2">
        <section className="flex flex-col rounded-xl border border-border bg-card/70 p-5 shadow-sm lg:min-h-0">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Persona roster
              </p>
              <h1 className="text-2xl font-semibold">Curate your personas</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Add, rename, or remove personas.
              </p>
            </div>
            <form className="flex flex-col gap-2 md:w-80" onSubmit={handleCreatePersona}>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Add new persona
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                  placeholder="e.g. Insight Analyst"
                  value={newPersonaName}
                  onChange={(event) => setNewPersonaName(event.target.value)}
                  disabled={isSubmittingPersona || isLoadingPersonas}
                />
                <Button
                  type="submit"
                  disabled={isSubmittingPersona || isLoadingPersonas}
                  className="gap-1"
                >
                  {isSubmittingPersona ? (
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                  ) : (
                    <PlusIcon className="h-4 w-4" />
                  )}
                  Add
                </Button>
              </div>
            </form>
          </div>
          <div className="mt-6 overflow-x-auto lg:flex-1 lg:min-h-0 lg:overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2">Name</th>
                  <th className="py-2">Documents</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingPersonas ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-muted-foreground">
                      <Loader2Icon className="inline h-4 w-4 animate-spin" /> Loading personas…
                    </td>
                  </tr>
                ) : !personas.length ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-muted-foreground">
                      No personas available.
                    </td>
                  </tr>
                ) : (
                  personas.map((persona) => (
                    <tr key={persona.id} className="border-t border-border/50">
                      <td className="py-3 font-medium">{persona.display_name}</td>
                      <td className="py-3">{persona.document_count}</td>
                      <td className="py-3">
                        <div className="flex flex-col justify-end gap-2 sm:flex-row">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRenamePersona(persona)}
                            className="gap-1"
                          >
                            <PencilIcon className="h-4 w-4" /> Rename
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeletePersona(persona)}
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
          {(personaActionMessage || personaActionError || personasError) && (
            <div className="mt-4 flex-shrink-0 space-y-1 text-sm">
              {personaActionMessage && <p className="text-green-600">{personaActionMessage}</p>}
              {personaActionError && <p className="text-red-500">{personaActionError}</p>}
              {personasError && <p className="text-red-500">{personasError}</p>}
            </div>
          )}
        </section>

        <section className="flex flex-col rounded-xl border border-border bg-card/70 p-5 shadow-sm lg:min-h-0">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Persona documents
              </p>
              <h2 className="text-2xl font-semibold">Keep knowledge tidy</h2>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRefreshPersonas}
              disabled={isLoadingPersonas}
              className="gap-1"
            >
              <RefreshCwIcon className={cn("h-4 w-4", isLoadingPersonas && "animate-spin")} />
              Refresh personas
            </Button>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Active persona
            </label>
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              value={selectedPersonaId ?? ""}
              onChange={(event) => {
                setSelectedPersonaId(event.target.value || null);
              }}
              disabled={isLoadingPersonas}
            >
              <option value="" disabled>
                {isLoadingPersonas
                  ? "Loading personas..."
                  : personas.length
                    ? "Select a persona"
                    : "No personas found"}
              </option>
              {personas.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.display_name}
                </option>
              ))}
            </select>
            {personasError && <p className="text-xs text-red-500">{personasError}</p>}
          </div>
          <div className="mt-4 flex-1 overflow-hidden rounded-lg border border-dashed border-border/70 bg-card/60">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-2 text-sm">
              <p className="font-medium">Documents</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {selectedPersona && (
                  <span>
                    {documents.length} file{documents.length === 1 ? "" : "s"} linked to {selectedPersona.display_name}
                  </span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!selectedPersona || isUploading}
                >
                  {isUploading ? (
                    <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <PlusIcon className="h-3.5 w-3.5" />
                  )}
                  Upload
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileSelection}
                  disabled={!selectedPersona || isUploading}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoadingDocuments ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  <Loader2Icon className="mr-2 inline h-4 w-4 animate-spin" />
                  Loading documents…
                </p>
              ) : documentsError ? (
                <p className="px-4 py-6 text-sm text-red-500">{documentsError}</p>
              ) : !documents.length ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  No documents found. Upload PDFs, text, or markdown files to give this persona context.
                </p>
              ) : (
                <ul className="divide-y divide-border/70">
                  {documents.map((document) => (
                    <li
                      key={document.relative_path}
                      className="flex flex-col gap-2 px-4 py-3 text-sm md:flex-row md:items-center md:gap-4"
                    >
                      <div className="flex-1">
                        <p className="font-medium" title={document.filename}>
                          {document.filename}
                        </p>
                        <p
                          className="text-xs text-muted-foreground break-all"
                          title={document.relative_path}
                        >
                          {document.relative_path}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{formatSize(document.size_bytes)}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => onViewDocument?.(document)}
                        >
                          <ExternalLinkIcon className="h-3.5 w-3.5" /> Open
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="gap-1"
                          onClick={() => handleDelete(document.relative_path)}
                        >
                          <Trash2Icon className="h-3.5 w-3.5" /> Remove
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {(successMessage || documentsError) && (
              <div className="border-t border-border/60 px-4 py-2 text-xs">
                {successMessage && <p className="text-green-600">{successMessage}</p>}
                {documentsError && <p className="text-red-500">{documentsError}</p>}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

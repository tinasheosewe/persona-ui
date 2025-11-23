"use client";

import {
  ActionBarPrimitive,
  BranchPickerPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react";
import type { FC } from "react";
import {
  ArrowDownIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
  CopyIcon,
  PencilIcon,
  RefreshCwIcon,
  SendHorizontalIcon,
  SparklesIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { useCharacterOptions } from "@/app/MyRuntimeProvider";

export const Thread: FC = () => {
  return (
    <ThreadPrimitive.Root
      className="bg-background box-border flex h-full min-h-0 flex-1 flex-col overflow-hidden"
      style={{
        ["--thread-max-width" as string]: "42rem",
      }}
    >
      <div className="flex flex-shrink-0 items-center justify-center border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/50">
        <div className="w-full max-w-[var(--thread-max-width)]">
          <CharacterSelector />
        </div>
      </div>

  <ThreadPrimitive.Viewport className="flex-1 min-h-0 overflow-y-auto bg-inherit px-4 py-6">
        <div className="mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col">
          <ThreadWelcome />

          <ThreadPrimitive.Messages
            components={{
              UserMessage: UserMessage,
              EditComposer: EditComposer,
              AssistantMessage: AssistantMessage,
            }}
          />

          <ThreadPrimitive.If empty={false}>
            <div className="min-h-8" />
          </ThreadPrimitive.If>
        </div>
      </ThreadPrimitive.Viewport>

      <div className="flex flex-shrink-0 items-center justify-center border-t border-border bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="relative w-full max-w-[var(--thread-max-width)]">
          <ThreadScrollToBottom />
          <Composer />
        </div>
      </div>
    </ThreadPrimitive.Root>
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
  const { isLoadingCharacters, selectedCharacter } = useCharacterOptions();
  const composerDisabled = isLoadingCharacters || !selectedCharacter;
  const placeholder = isLoadingCharacters
    ? "Loading characters..."
    : !selectedCharacter
      ? "Select a character to start"
      : "Write a message...";

  return (
    <ComposerPrimitive.Root
      className="focus-within:border-ring/20 flex w-full flex-wrap items-end rounded-lg border bg-inherit px-2.5 shadow-sm transition-colors ease-in"
      data-disabled={composerDisabled || undefined}
    >
      <ComposerPrimitive.Input
        rows={1}
        autoFocus
        disabled={composerDisabled}
        placeholder={placeholder}
        className="placeholder:text-muted-foreground max-h-40 flex-grow resize-none border-none bg-transparent px-2 py-4 text-sm outline-none focus:ring-0 disabled:cursor-not-allowed"
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
            className="my-2.5 size-8 p-2 transition-opacity ease-in"
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
            className="my-2.5 size-8 p-2 transition-opacity ease-in"
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

      <BranchPicker className="col-span-full col-start-1 row-start-3 -mr-1 justify-end" />
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

      <BranchPicker className="col-start-2 row-start-2 mr-2 -ml-2" />
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
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
    </ActionBarPrimitive.Root>
  );
};

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
  className,
  ...rest
}) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        "text-muted-foreground inline-flex items-center text-xs",
        className,
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton tooltip="Previous">
          <ChevronLeftIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      <span className="font-medium">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <TooltipIconButton tooltip="Next">
          <ChevronRightIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};

const CharacterSelector: FC<{ className?: string }> = ({ className }) => {
  const {
    characters,
    selectedCharacter,
    selectCharacter,
    isLoadingCharacters,
    charactersError,
  } = useCharacterOptions();

  const hasCharacters = characters.length > 0;
  const selectDisabled = isLoadingCharacters || !hasCharacters;
  const personaStatus = charactersError
    ? charactersError
    : selectedCharacter
      ? `${selectedCharacter.documentCount} document${selectedCharacter.documentCount === 1 ? "" : "s"}`
      : hasCharacters
        ? "Choose a persona to chat"
        : "No personas available";

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2 rounded-2xl border border-border/60 bg-card/70 px-3 py-2 text-sm shadow-sm sm:flex-row sm:items-center sm:gap-4",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.45em] text-muted-foreground">
        <SparklesIcon className="h-3.5 w-3.5 text-amber-500" />
        Persona
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <select
          className="flex-1 min-w-[160px] rounded-full border border-border/50 bg-background/80 px-3 py-1.5 text-sm font-medium text-foreground transition focus-visible:border-ring focus-visible:bg-background focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          value={selectedCharacter?.id ?? ""}
          onChange={(event) => selectCharacter(event.target.value)}
          disabled={selectDisabled}
        >
          <option value="" disabled>
            {isLoadingCharacters
              ? "Loading personas..."
              : hasCharacters
                ? "Select a persona"
                : "No personas found"}
          </option>
          {characters.map((character) => (
            <option key={character.id} value={character.id}>
              {character.displayName}
            </option>
          ))}
        </select>
        {isLoadingCharacters && (
          <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
        )}
      </div>
      <div
        className={cn(
          "text-xs text-muted-foreground sm:text-right",
          charactersError && "text-red-500",
        )}
      >
        {personaStatus}
      </div>
    </div>
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

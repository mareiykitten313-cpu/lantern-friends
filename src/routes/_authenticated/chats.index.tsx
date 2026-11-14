import { createFileRoute } from "@tanstack/react-router";
import { LanternMark } from "@/components/chat/brand";

export const Route = createFileRoute("/_authenticated/chats/")({
  component: EmptyState,
});

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-sky px-8 text-center">
      <LanternMark className="size-20 animate-flicker" />
      <h2 className="font-display text-2xl font-semibold">Pick a chat to light up</h2>
      <p className="max-w-xs text-sm text-muted-foreground">
        Choose a conversation on the left, or start a new one with a friend.
      </p>
    </div>
  );
}

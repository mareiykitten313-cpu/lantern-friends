import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UserAvatar, Wordmark } from "@/components/chat/brand";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage, memberName, type Profile } from "@/lib/chat";
import { normalizeUsername } from "@/lib/usernames";

export const Route = createFileRoute("/_authenticated/add/$username")({
  head: () => ({
    meta: [
      { title: "You're invited — Lantern" },
      { name: "description", content: "A friend invited you to chat on Lantern." },
      { property: "og:title", content: "You're invited to chat on Lantern" },
      { property: "og:description", content: "Open the link to start chatting with your friend on Lantern." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { username } = Route.useParams();
  const { userId } = Route.useRouteContext();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const handle = normalizeUsername(username);

  const { data: friend, isLoading } = useQuery({
    queryKey: ["invite", handle],
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .eq("username", handle)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  async function start() {
    if (!friend) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("get_or_create_dm", { _other: friend.id });
    setBusy(false);
    if (error || !data) { toast.error(errorMessage(error, "Couldn't start the chat")); return; }
    navigate({ to: "/chats/$conversationId", params: { conversationId: data }, replace: true });
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-sky px-5">
      <Wordmark />
      <div className="w-full max-w-sm animate-rise rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
        {isLoading ? (
          <div className="mx-auto size-16 animate-pulse rounded-full bg-muted" />
        ) : !friend ? (
          <>
            <h1 className="text-2xl font-semibold">Invite not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">Nobody goes by @{handle} on Lantern right now.</p>
            <Button asChild variant="soft" className="mt-6">
              <Link to="/chats">Go to my chats</Link>
            </Button>
          </>
        ) : friend.id === userId ? (
          <>
            <UserAvatar name={memberName(friend)} seed={friend.id} size="lg" className="mx-auto" />
            <h1 className="mt-4 text-2xl font-semibold">This is your invite link</h1>
            <p className="mt-2 text-sm text-muted-foreground">Share it with friends — opening it starts a chat with you.</p>
            <Button asChild variant="soft" className="mt-6">
              <Link to="/chats">Go to my chats</Link>
            </Button>
          </>
        ) : (
          <>
            <UserAvatar name={memberName(friend)} seed={friend.id} size="lg" className="mx-auto" />
            <h1 className="mt-4 text-2xl font-semibold">{memberName(friend)}</h1>
            <p className="text-sm text-muted-foreground">@{friend.username} invited you to chat</p>
            <Button variant="lantern" size="lg" className="mt-6 w-full" onClick={start} disabled={busy}>
              {busy ? "Opening…" : `Start chatting with ${memberName(friend).split(" ")[0]}`}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

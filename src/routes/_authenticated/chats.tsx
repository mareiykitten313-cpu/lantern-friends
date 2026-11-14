import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useParams } from "@tanstack/react-router";
import { formatDistanceToNowStrict } from "date-fns";
import { MessageCirclePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { GroupAvatar, ThemeToggle, UserAvatar, Wordmark } from "@/components/chat/brand";
import { NewChatDialog } from "@/components/chat/new-chat-dialog";
import { ProfileDialog } from "@/components/chat/profile-dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  conversationTitle,
  conversationsQuery,
  insertMessageSorted,
  memberName,
  otherMembers,
  profileQuery,
  type Message,
} from "@/lib/chat";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/chats")({
  head: () => ({
    meta: [
      { title: "Chats — Lantern" },
      { name: "description", content: "Your conversations on Lantern." },
      { property: "og:title", content: "Chats — Lantern" },
      { property: "og:description", content: "Your conversations on Lantern." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(conversationsQuery()),
      context.queryClient.ensureQueryData(profileQuery(context.userId)),
    ]);
  },
  component: ChatsLayout,
});

function useRealtime(meId: string) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel(`lantern-${meId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new as Message;
        queryClient.setQueryData<Message[]>(["messages", msg.conversation_id], (old) =>
          old ? insertMessageSorted(old, msg) : old,
        );
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (payload) => {
        const id = (payload.old as { id?: string }).id;
        if (!id) return;
        queryClient.setQueriesData<Message[]>({ queryKey: ["messages"] }, (old) => old?.filter((m) => m.id !== id));
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_members" }, () => {
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations" }, () => {
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [meId, queryClient]);
}

function ChatsLayout() {
  const { userId } = Route.useRouteContext();
  const { data: conversations } = useSuspenseQuery(conversationsQuery());
  const { data: me } = useSuspenseQuery(profileQuery(userId));
  const params = useParams({ strict: false }) as { conversationId?: string };
  const activeId = params.conversationId;
  const [newOpen, setNewOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useRealtime(userId);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <aside
        className={cn(
          "flex w-full flex-col border-r border-border bg-panel md:w-[340px] md:shrink-0",
          activeId && "hidden md:flex",
        )}
      >
        <header className="flex items-center justify-between px-4 pb-2 pt-4">
          <Wordmark />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="rounded-full ring-offset-2 ring-offset-panel transition hover:ring-2 hover:ring-primary"
              aria-label="Your profile and settings"
            >
              <UserAvatar name={memberName(me)} seed={me.id} size="sm" />
            </button>
          </div>
        </header>

        <div className="px-4 pb-3 pt-2">
          <Button variant="lantern" className="h-11 w-full" onClick={() => setNewOpen(true)}>
            <MessageCirclePlus /> New chat
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-4 scrollbar-thin" aria-label="Conversations">
          {conversations.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="font-display text-lg font-semibold">No chats yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Tap “New chat” to find a friend, or share your invite link from your profile.
              </p>
              <Button variant="soft" size="sm" className="mt-4" onClick={() => setProfileOpen(true)}>
                Get my invite link
              </Button>
            </div>
          ) : (
            <ul className="grid gap-0.5">
              {conversations.map((c) => {
                const title = conversationTitle(c, userId);
                const others = otherMembers(c, userId);
                const active = c.id === activeId;
                const unread = c.unread_count > 0 && !active;
                return (
                  <li key={c.id}>
                    <Link
                      to="/chats/$conversationId"
                      params={{ conversationId: c.id }}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-accent/60",
                        active && "bg-accent",
                      )}
                    >
                      {c.is_group ? (
                        <GroupAvatar names={others.map(memberName)} seed={c.id} />
                      ) : (
                        <UserAvatar name={title} seed={others[0]?.id ?? c.id} />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={cn("truncate text-[15px]", unread ? "font-semibold" : "font-medium")}>{title}</span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {c.last_message_preview ? formatDistanceToNowStrict(new Date(c.last_message_at)) : ""}
                          </span>
                        </span>
                        <span className="flex items-center justify-between gap-2">
                          <span className={cn("truncate text-sm", unread ? "text-foreground" : "text-muted-foreground")}>
                            {c.last_message_preview ?? (c.is_group ? `${c.members.length} members` : "Say hello 👋")}
                          </span>
                          {unread && (
                            <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground shadow-glow">
                              {c.unread_count > 99 ? "99+" : c.unread_count}
                            </span>
                          )}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>
      </aside>

      <main className={cn("min-w-0 flex-1", !activeId && "hidden md:block")}>
        <Outlet />
      </main>

      <NewChatDialog open={newOpen} onOpenChange={setNewOpen} meId={userId} />
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} profile={me} />
    </div>
  );
}

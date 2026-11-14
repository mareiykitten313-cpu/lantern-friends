import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { format, isSameDay, isToday, isYesterday } from "date-fns";
import { ArrowLeft, LogOut, MoreVertical, UserPlus } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GroupAvatar, UserAvatar } from "@/components/chat/brand";
import { Composer } from "@/components/chat/composer";
import { PeopleSearch } from "@/components/chat/people-search";
import { supabase } from "@/integrations/supabase/client";
import {
  conversationTitle,
  conversationsQuery,
  errorMessage,
  insertMessageSorted,
  memberName,
  messagesQuery,
  otherMembers,
  photoUrlQuery,
  type ConversationSummary,
  type Member,
  type Message,
} from "@/lib/chat";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/chats/$conversationId")({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(messagesQuery(params.conversationId));
  },
  component: ConversationPage,
});

function dayLabel(d: Date) {
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, MMM d");
}

function ConversationPage() {
  const { conversationId } = Route.useParams();
  const { userId } = Route.useRouteContext();
  const { data: conversations } = useSuspenseQuery(conversationsQuery());
  const conv = conversations.find((c) => c.id === conversationId);

  if (!conv) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <h2 className="font-display text-xl font-semibold">This chat isn't here</h2>
        <p className="text-sm text-muted-foreground">It may have been left, or you aren't a member.</p>
        <Button asChild variant="soft">
          <Link to="/chats">Back to chats</Link>
        </Button>
      </div>
    );
  }
  return <Thread key={conv.id} conv={conv} meId={userId} />;
}

function Thread({ conv, meId }: { conv: ConversationSummary; meId: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: messages } = useSuspenseQuery(messagesQuery(conv.id));
  const scrollRef = useRef<HTMLDivElement>(null);
  const [addOpen, setAddOpen] = useState(false);
  const title = conversationTitle(conv, meId);
  const others = otherMembers(conv, meId);
  const membersById = new Map<string, Member>(conv.members.map((m) => [m.id, m]));

  // Keep pinned to the newest message.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Mark as read whenever new messages arrive while open.
  useEffect(() => {
    supabase
      .from("conversation_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conv.id)
      .eq("user_id", meId)
      .then(({ error }) => {
        if (error) return;
        queryClient.setQueryData<ConversationSummary[]>(["conversations"], (old) =>
          old?.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c)),
        );
      });
  }, [conv.id, meId, messages.length, queryClient]);

  async function send(body: string, file: File | null) {
    try {
      let image_path: string | null = null;
      if (file) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        image_path = `${conv.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("chat-photos").upload(image_path, file, {
          contentType: file.type || "image/jpeg",
        });
        if (upErr) throw upErr;
      }
      const { data, error } = await supabase
        .from("messages")
        .insert({ conversation_id: conv.id, sender_id: meId, body: body || null, image_path })
        .select("id, conversation_id, sender_id, body, image_path, created_at")
        .single();
      if (error) throw error;
      queryClient.setQueryData<Message[]>(["messages", conv.id], (old) => insertMessageSorted(old, data));
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      return true;
    } catch (e) {
      toast.error(errorMessage(e, "Message didn't send"));
      return false;
    }
  }

  async function leave() {
    const { error } = await supabase.rpc("leave_conversation", { _conversation: conv.id });
    if (error) { toast.error(errorMessage(error)); return; }
    await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    navigate({ to: "/chats" });
  }

  async function addMembers(ids: string[]) {
    const { error } = await supabase.rpc("add_group_members", { _conversation: conv.id, _members: ids });
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success("Added to the group");
    setAddOpen(false);
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-panel/80 px-3 py-2.5 backdrop-blur">
        <Button asChild variant="ghost" size="icon" className="md:hidden" aria-label="Back to chats">
          <Link to="/chats">
            <ArrowLeft className="!size-5" />
          </Link>
        </Button>
        {conv.is_group ? (
          <GroupAvatar names={others.map(memberName)} seed={conv.id} />
        ) : (
          <UserAvatar name={title} seed={others[0]?.id ?? conv.id} />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-semibold leading-tight">{title}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {conv.is_group ? conv.members.map(memberName).join(", ") : others[0] ? `@${others[0].username}` : ""}
          </p>
        </div>
        {conv.is_group && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Group options">
                <MoreVertical className="!size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl">
              <DropdownMenuItem onSelect={() => setAddOpen(true)}>
                <UserPlus /> Add people
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={leave} className="text-destructive focus:text-destructive">
                <LogOut /> Leave group
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-sky px-3 py-4 scrollbar-thin md:px-8">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="font-display text-xl font-semibold">Light the first lantern</p>
            <p className="text-sm text-muted-foreground">Say hi to {title} 👋</p>
          </div>
        ) : (
          <ol className="mx-auto flex max-w-3xl flex-col">
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const next = messages[i + 1];
              const d = new Date(m.created_at);
              const newDay = !prev || !isSameDay(new Date(prev.created_at), d);
              const sameAsPrev = !!prev && !newDay && prev.sender_id === m.sender_id && d.getTime() - new Date(prev.created_at).getTime() < 5 * 60_000;
              const sameAsNext = !!next && isSameDay(new Date(next.created_at), d) && next.sender_id === m.sender_id && new Date(next.created_at).getTime() - d.getTime() < 5 * 60_000;
              const mine = m.sender_id === meId;
              const sender = membersById.get(m.sender_id);
              return (
                <li key={m.id} className={cn("flex flex-col", sameAsPrev ? "mt-0.5" : "mt-3")}>
                  {newDay && (
                    <div className="my-3 self-center rounded-full bg-secondary px-3 py-1 text-[11px] font-medium text-muted-foreground">
                      {dayLabel(d)}
                    </div>
                  )}
                  <div className={cn("flex items-end gap-2", mine ? "flex-row-reverse" : "flex-row")}>
                    {!mine && conv.is_group && (
                      <span className="w-8 shrink-0">
                        {!sameAsNext && sender && <UserAvatar name={memberName(sender)} seed={sender.id} size="sm" />}
                      </span>
                    )}
                    <div className={cn("flex max-w-[78%] flex-col md:max-w-[65%]", mine ? "items-end" : "items-start")}>
                      {!mine && conv.is_group && !sameAsPrev && (
                        <span className="mb-1 px-3 text-xs font-medium text-muted-foreground">
                          {sender ? memberName(sender) : "Former member"}
                        </span>
                      )}
                      <Bubble m={m} mine={mine} tailed={!sameAsNext} />
                      {!sameAsNext && (
                        <span className="mt-1 px-2 text-[10px] text-muted-foreground">{format(d, "h:mm a")}</span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <Composer onSend={send} />

      {conv.is_group && (
        <AddPeopleDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          meId={meId}
          memberIds={conv.members.map((m) => m.id)}
          onAdd={addMembers}
        />
      )}
    </div>
  );
}

function Bubble({ m, mine, tailed }: { m: Message; mine: boolean; tailed: boolean }) {
  return (
    <div
      className={cn(
        "animate-rise overflow-hidden rounded-3xl shadow-soft",
        mine ? "bg-bubble-mine text-bubble-mine-foreground" : "bg-bubble-theirs text-bubble-theirs-foreground",
        tailed && (mine ? "rounded-br-md" : "rounded-bl-md"),
      )}
    >
      {m.image_path && <Photo path={m.image_path} />}
      {m.body && <p className="whitespace-pre-wrap break-words px-4 py-2 text-[15px] leading-snug">{m.body}</p>}
    </div>
  );
}

function Photo({ path }: { path: string }) {
  const { data: url } = useQuery(photoUrlQuery(path));
  const [open, setOpen] = useState(false);
  if (!url) return <div className="h-48 w-60 animate-pulse bg-muted" />;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block" aria-label="Open photo">
        <img src={url} alt="Shared photo" loading="lazy" className="max-h-80 w-full max-w-72 object-cover" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl border-none bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">Photo</DialogTitle>
          <img src={url} alt="Shared photo" className="max-h-[85dvh] w-full rounded-2xl object-contain" />
        </DialogContent>
      </Dialog>
    </>
  );
}

function AddPeopleDialog({
  open,
  onOpenChange,
  meId,
  memberIds,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  meId: string;
  memberIds: string[];
  onAdd: (ids: string[]) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Add people</DialogTitle>
          <DialogDescription>Tap a friend to bring them into the group.</DialogDescription>
        </DialogHeader>
        <PeopleSearch meId={meId} excludeIds={memberIds} onPick={(p) => onAdd([p.id])} />
      </DialogContent>
    </Dialog>
  );
}

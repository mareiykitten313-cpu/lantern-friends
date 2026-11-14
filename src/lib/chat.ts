import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Member = { id: string; username: string; display_name: string };

export type ConversationSummary = {
  id: string;
  is_group: boolean;
  name: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
  members: Member[];
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  image_path: string | null;
  created_at: string;
};

export type Profile = { id: string; username: string; display_name: string };

export const conversationsQuery = () =>
  queryOptions({
    queryKey: ["conversations"],
    queryFn: async (): Promise<ConversationSummary[]> => {
      const { data, error } = await supabase.rpc("list_my_conversations");
      if (error) throw error;
      return (data ?? []).map((c) => ({
        ...c,
        unread_count: Number(c.unread_count ?? 0),
        members: (c.members as unknown as Member[]) ?? [],
      }));
    },
  });

export const profileQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profile", userId],
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .eq("id", userId)
        .single();
      if (error) throw error;
      return data;
    },
  });

export const messagesQuery = (conversationId: string) =>
  queryOptions({
    queryKey: ["messages", conversationId],
    queryFn: async (): Promise<Message[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, body, image_path, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []).reverse();
    },
  });

export const photoUrlQuery = (path: string) =>
  queryOptions({
    queryKey: ["photo", path],
    staleTime: 1000 * 60 * 50,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("chat-photos").createSignedUrl(path, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });

export function otherMembers(conv: ConversationSummary, meId: string) {
  return conv.members.filter((m) => m.id !== meId);
}

export function conversationTitle(conv: ConversationSummary, meId: string) {
  if (conv.is_group) return conv.name || "Group";
  const other = otherMembers(conv, meId)[0];
  return other ? other.display_name || other.username : "Just you";
}

export function memberName(m: Pick<Member, "display_name" | "username">) {
  return m.display_name || m.username;
}

export function insertMessageSorted(list: Message[] | undefined, msg: Message): Message[] {
  const current = list ?? [];
  if (current.some((m) => m.id === msg.id)) return current;
  return [...current, msg].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function errorMessage(e: unknown, fallback = "Something went wrong") {
  if (e && typeof e === "object" && "message" in e && typeof e.message === "string") return e.message;
  return fallback;
}

import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage, memberName, type Profile } from "@/lib/chat";
import { PeopleSearch } from "./people-search";

export function NewChatDialog({
  open,
  onOpenChange,
  meId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  meId: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [groupName, setGroupName] = useState("");
  const [picked, setPicked] = useState<Profile[]>([]);
  const [busy, setBusy] = useState(false);

  const done = async (id: string) => {
    await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    onOpenChange(false);
    setPicked([]);
    setGroupName("");
    navigate({ to: "/chats/$conversationId", params: { conversationId: id } });
  };

  async function startDm(p: Profile) {
    setBusy(true);
    const { data, error } = await supabase.rpc("get_or_create_dm", { _other: p.id });
    setBusy(false);
    if (error || !data) { toast.error(errorMessage(error, "Couldn't start that chat")); return; }
    done(data);
  }

  async function createGroup() {
    setBusy(true);
    const { data, error } = await supabase.rpc("create_group", {
      _name: groupName,
      _members: picked.map((p) => p.id),
    });
    setBusy(false);
    if (error || !data) { toast.error(errorMessage(error, "Couldn't create the group")); return; }
    done(data);
  }

  const toggle = (p: Profile) =>
    setPicked((list) => (list.some((x) => x.id === p.id) ? list.filter((x) => x.id !== p.id) : [...list, p]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">New chat</DialogTitle>
          <DialogDescription>Find a friend by username, or gather a few into a group.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="friend">
          <TabsList className="grid w-full grid-cols-2 rounded-full">
            <TabsTrigger value="friend" className="rounded-full">Friend</TabsTrigger>
            <TabsTrigger value="group" className="rounded-full">Group</TabsTrigger>
          </TabsList>
          <TabsContent value="friend" className="mt-4">
            <PeopleSearch meId={meId} onPick={(p) => !busy && startDm(p)} />
          </TabsContent>
          <TabsContent value="group" className="mt-4 grid gap-3">
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name (e.g. Rooftop crew)"
              maxLength={60}
              className="h-11 rounded-full"
            />
            {picked.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {picked.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p)}
                    className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground"
                  >
                    {memberName(p)} <X className="size-3" />
                  </button>
                ))}
              </div>
            )}
            <PeopleSearch meId={meId} selected={picked.map((p) => p.id)} onPick={toggle} />
            <Button
              variant="lantern"
              size="lg"
              disabled={busy || !groupName.trim() || picked.length === 0}
              onClick={createGroup}
            >
              {busy ? "Creating…" : `Create group${picked.length ? ` with ${picked.length}` : ""}`}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

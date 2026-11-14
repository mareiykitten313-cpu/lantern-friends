import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Copy, LogOut, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage, type Profile } from "@/lib/chat";
import { useTheme } from "@/lib/theme";
import { inviteLink, isValidUsername, normalizeUsername } from "@/lib/usernames";
import { UserAvatar } from "./brand";

export function ProfileDialog({
  open,
  onOpenChange,
  profile,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profile: Profile;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState(profile.display_name);
  const [username, setUsername] = useState(profile.username);
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  useEffect(() => {
    if (open) {
      setName(profile.display_name);
      setUsername(profile.username);
    }
  }, [open, profile]);

  const link = inviteLink(origin, profile.username);

  async function save() {
    if (!isValidUsername(username)) { toast.error("Usernames need 3–24 letters, numbers or underscores."); return; }
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name.trim().slice(0, 60), username })
      .eq("id", profile.id);
    setBusy(false);
    if (error) {
      { toast.error(error.code === "23505" ? `@${username} is already taken` : errorMessage(error)); return; }
    }
    toast.success("Profile saved");
    queryClient.invalidateQueries({ queryKey: ["profile", profile.id] });
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Invite link copied");
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually");
    }
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader className="items-center text-center sm:items-center sm:text-center">
          <UserAvatar name={name || username} seed={profile.id} size="lg" />
          <DialogTitle className="pt-2 font-display text-2xl">{name || username}</DialogTitle>
          <DialogDescription>@{profile.username}</DialogDescription>
        </DialogHeader>

        <section className="grid gap-2 rounded-2xl bg-secondary p-4">
          <p className="text-sm font-medium">Your invite link</p>
          <p className="text-xs text-muted-foreground">Send this to a friend — opening it starts a chat with you.</p>
          <div className="flex gap-2">
            <Input readOnly value={link} className="h-10 rounded-full bg-background text-xs" onFocus={(e) => e.target.select()} />
            <Button variant="lantern" size="icon" className="size-10 shrink-0" onClick={copy} aria-label="Copy invite link">
              <Copy />
            </Button>
          </div>
        </section>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="pname">Name</Label>
            <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="h-11 rounded-xl" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="puser">Username</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
              <Input id="puser" value={username} onChange={(e) => setUsername(normalizeUsername(e.target.value))} className="h-11 rounded-xl pl-7" autoCapitalize="none" />
            </div>
          </div>
          <Button onClick={save} disabled={busy} variant="soft">
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4">
          <div className="inline-flex rounded-full bg-secondary p-1">
            <Button size="sm" variant={theme === "light" ? "default" : "ghost"} onClick={() => setTheme("light")}>
              <Sun /> Light
            </Button>
            <Button size="sm" variant={theme === "dark" ? "default" : "ghost"} onClick={() => setTheme("dark")}>
              <Moon /> Dark
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-destructive hover:text-destructive">
            <LogOut /> Sign out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

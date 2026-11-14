import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wordmark } from "@/components/chat/brand";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — Lantern" },
      { name: "description", content: "Choose a new password for your Lantern account." },
      { property: "og:title", content: "Set a new password — Lantern" },
      { property: "og:description", content: "Choose a new password for your Lantern account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated");
    navigate({ to: "/chats", replace: true });
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-sky px-5">
      <Wordmark />
      <form onSubmit={onSubmit} className="grid w-full max-w-sm gap-4 rounded-3xl border border-border bg-card p-7 shadow-soft">
        <h1 className="text-2xl font-semibold">Set a new password</h1>
        <div className="grid gap-1.5">
          <Label htmlFor="pw">New password</Label>
          <Input id="pw" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className="h-11 rounded-xl" />
        </div>
        <Button type="submit" variant="lantern" size="lg" disabled={busy}>
          {busy ? "Saving…" : "Save password"}
        </Button>
      </form>
    </div>
  );
}

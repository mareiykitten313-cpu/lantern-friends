import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import "@lovable.dev/cloud-auth-js/styles.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleIcon, ThemeToggle, Wordmark } from "@/components/chat/brand";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { isValidUsername, normalizeUsername, safeRedirect } from "@/lib/usernames";
import heroImage from "@/assets/lantern-hero.jpg";

const PENDING_KEY = "lantern-after-auth";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const redirect = safeRedirect(search["redirect"]);
    return redirect ? { redirect } : {};
  },
  head: () => ({
    meta: [
      { title: "Sign in — Lantern" },
      { name: "description", content: "Sign in or create your Lantern account to start texting your friends." },
      { property: "og:title", content: "Sign in — Lantern" },
      { property: "og:description", content: "Sign in or create your Lantern account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const { redirect } = Route.useSearch();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", password: "", displayName: "", username: "" });

  const destination = () => {
    let stored: string | undefined;
    try {
      stored = safeRedirect(sessionStorage.getItem(PENDING_KEY));
      sessionStorage.removeItem(PENDING_KEY);
    } catch {
      /* ignore */
    }
    return redirect ?? stored ?? "/chats";
  };

  // Already signed in (or just returned from Google) → go on.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.history.replace(destination());
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) router.history.replace(destination());
    });
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: k === "username" ? normalizeUsername(e.target.value) : e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
        if (error) throw error;
      } else if (mode === "signup") {
        if (!isValidUsername(form.username)) {
          toast.error("Usernames need 3–24 letters, numbers or underscores.");
          return;
        }
        const { data: taken } = await supabase.rpc("username_taken", { _username: form.username });
        if (taken) {
          toast.error(`@${form.username} is already taken — try another.`);
          return;
        }
        const back = redirect ? `/auth?redirect=${encodeURIComponent(redirect)}` : "/auth";
        const { data, error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            emailRedirectTo: `${window.location.origin}${back}`,
            data: { username: form.username, display_name: form.displayName.trim() || form.username },
          },
        });
        if (error) throw error;
        if (!data.session) setCheckEmail(form.email);
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Check your inbox for a reset link.");
        setMode("signin");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't sign you in");
    } finally {
      setBusy(false);
    }
  }

  async function oauth(provider: "google" | "lovable") {
    try {
      if (redirect) sessionStorage.setItem(PENDING_KEY, redirect);
    } catch {
      /* ignore */
    }
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: `${window.location.origin}/auth`,
    });
    if (result.error) {
      toast.error(result.error.message || "Sign in didn't finish");
      return;
    }
    if (result.redirected) return;
    router.history.replace(destination());
  }

  return (
    <div className="grid min-h-dvh md:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-night md:block">
        <img src={heroImage} alt="" width={1024} height={1280} className="absolute inset-0 size-full object-cover opacity-90" />
        <div className="absolute inset-x-0 bottom-0 p-10 text-night-foreground">
          <p className="font-display text-4xl font-semibold leading-tight">Every chat, a little warmer.</p>
        </div>
      </aside>

      <main className="flex flex-col bg-sky md:bg-none">
        <header className="flex items-center justify-between px-5 py-5">
          <Link to="/" aria-label="Lantern home">
            <Wordmark />
          </Link>
          <ThemeToggle />
        </header>

        <div className="flex flex-1 items-center justify-center px-5 pb-12">
          <div className="w-full max-w-sm animate-rise">
            {checkEmail ? (
              <div className="rounded-3xl border border-border bg-card p-7 text-center shadow-soft">
                <h1 className="text-2xl font-semibold">Check your email</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  We sent a confirmation link to <span className="font-medium text-foreground">{checkEmail}</span>. Open it
                  to light up your account.
                </p>
                <Button variant="soft" className="mt-6" onClick={() => { setCheckEmail(null); setMode("signin"); }}>
                  Back to sign in
                </Button>
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-semibold">
                  {mode === "signin" ? "Welcome back" : mode === "signup" ? "Make your lantern" : "Reset password"}
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {mode === "signin"
                    ? "Your friends are waiting."
                    : mode === "signup"
                      ? "Pick a username so friends can find you."
                      : "We'll email you a link to set a new one."}
                </p>

                {mode !== "forgot" && (
                  <div className="mt-6 grid gap-2.5">
                    <Button type="button" variant="google" size="lg" className="w-full" onClick={() => oauth("google")}>
                      <GoogleIcon />
                      Continue with Google
                    </Button>
                    <button type="button" className="lovable-auth-button w-full" onClick={() => oauth("lovable")}>
                      Continue with Lovable
                    </button>
                    <div className="my-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="h-px flex-1 bg-border" /> or with email <span className="h-px flex-1 bg-border" />
                    </div>
                  </div>
                )}

                <form onSubmit={onSubmit} className={mode === "forgot" ? "mt-6 grid gap-4" : "grid gap-4"}>
                  {mode === "signup" && (
                    <>
                      <div className="grid gap-1.5">
                        <Label htmlFor="displayName">Your name</Label>
                        <Input id="displayName" value={form.displayName} onChange={set("displayName")} placeholder="Maya Rose" maxLength={60} className="h-11 rounded-xl" />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor="username">Username</Label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                          <Input id="username" required value={form.username} onChange={set("username")} placeholder="maya" className="h-11 rounded-xl pl-7" autoCapitalize="none" autoComplete="username" />
                        </div>
                      </div>
                    </>
                  )}
                  <div className="grid gap-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" required value={form.email} onChange={set("email")} placeholder="you@example.com" autoComplete="email" className="h-11 rounded-xl" />
                  </div>
                  {mode !== "forgot" && (
                    <div className="grid gap-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        {mode === "signin" && (
                          <button type="button" onClick={() => setMode("forgot")} className="text-xs text-muted-foreground hover:text-foreground">
                            Forgot?
                          </button>
                        )}
                      </div>
                      <Input id="password" type="password" required minLength={6} value={form.password} onChange={set("password")} autoComplete={mode === "signup" ? "new-password" : "current-password"} className="h-11 rounded-xl" />
                    </div>
                  )}
                  <Button type="submit" variant="lantern" size="lg" className="mt-1 w-full" disabled={busy}>
                    {busy ? "One moment…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
                  </Button>
                </form>

                <p className="mt-6 text-center text-sm text-muted-foreground">
                  {mode === "signin" ? (
                    <>New here? <button type="button" className="font-medium text-foreground underline-offset-4 hover:underline" onClick={() => setMode("signup")}>Create an account</button></>
                  ) : (
                    <>Have an account? <button type="button" className="font-medium text-foreground underline-offset-4 hover:underline" onClick={() => setMode("signin")}>Sign in</button></>
                  )}
                </p>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

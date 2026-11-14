import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Image as ImageIcon, Link2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle, Wordmark } from "@/components/chat/brand";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/lantern-hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lantern — warm little chats with your friends" },
      {
        name: "description",
        content: "Text your friends, start group chats and share photos. Lantern keeps your people close, day or night.",
      },
      { property: "og:title", content: "Lantern — warm little chats with your friends" },
      { property: "og:description", content: "Text friends, start group chats and share photos on Lantern." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  return (
    <div className="min-h-dvh bg-sky">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Wordmark />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {signedIn ? (
            <Button asChild variant="soft" size="sm">
              <Link to="/chats">Open chats</Link>
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-4 md:grid-cols-[1.1fr_1fr] md:pt-10">
        <section className="animate-rise">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            <span className="size-1.5 rounded-full bg-primary" /> Your people, one warm light away
          </p>
          <h1 className="font-display text-5xl font-semibold leading-[1.02] md:text-7xl">
            Little lights
            <br />
            for <span className="bg-lantern bg-clip-text text-transparent">big talks.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted-foreground">
            Lantern is a cozy place to text your friends — one-on-one, in groups, with photos — and it glows just right in
            light or dark.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="lantern" size="xl">
              <Link to={signedIn ? "/chats" : "/auth"}>{signedIn ? "Open Lantern" : "Light your lantern"}</Link>
            </Button>
          </div>

          <ul className="mt-10 grid max-w-md gap-3 text-sm">
            {[
              { icon: Users, text: "Group chats for the whole crew" },
              { icon: ImageIcon, text: "Share photos in a tap" },
              { icon: Link2, text: "Find friends by username or invite link" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-foreground/85">
                <span className="grid size-8 place-items-center rounded-full bg-secondary text-primary">
                  <Icon className="size-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </section>

        <div className="relative mx-auto w-full max-w-sm md:max-w-md">
          <div className="absolute -inset-6 rounded-[3rem] bg-primary/20 blur-3xl" aria-hidden="true" />
          <div className="relative overflow-hidden rounded-[2.5rem] border border-border bg-night shadow-glow">
            <img
              src={heroImage}
              alt="A glowing paper lantern rising into a dark night sky"
              width={1024}
              height={1280}
              className="aspect-[4/5] w-full object-cover animate-flicker"
            />
            <div className="absolute inset-x-4 bottom-4 space-y-2">
              <div className="ml-auto w-fit max-w-[80%] rounded-3xl rounded-br-md bg-bubble-mine px-4 py-2 text-sm text-bubble-mine-foreground shadow-soft">
                rooftop at 8? bring snacks 🏮
              </div>
              <div className="w-fit max-w-[80%] rounded-3xl rounded-bl-md bg-bubble-theirs px-4 py-2 text-sm text-bubble-theirs-foreground shadow-soft">
                already on my way ✨
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

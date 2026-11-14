import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function LanternMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8", className)}>
      <defs>
        <linearGradient id="lantern-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary-glow)" />
          <stop offset="100%" stopColor="var(--primary)" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="17" r="13" fill="var(--primary)" opacity="0.18" />
      <rect x="13" y="3" width="6" height="3" rx="1.2" fill="currentColor" opacity="0.75" />
      <path d="M9.5 9.5C9.5 7.6 11 6 13 6h6c2 0 3.5 1.6 3.5 3.5v11c0 2.5-2.9 5.5-6.5 5.5s-6.5-3-6.5-5.5v-11Z" fill="url(#lantern-body)" />
      <path d="M16 13.2c1.3 1.4 2 2.7 2 3.9a2 2 0 0 1-4 0c0-1.2.7-2.5 2-3.9Z" fill="var(--background)" opacity="0.85" />
      <rect x="13" y="26" width="6" height="2.4" rx="1.2" fill="currentColor" opacity="0.75" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LanternMark />
      <span className="font-display text-xl font-semibold tracking-tight">Lantern</span>
    </span>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      className={className}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}

const AVATAR_TONES = [
  "bg-chart-1 text-primary-foreground",
  "bg-chart-2 text-night-foreground",
  "bg-chart-3 text-night-foreground",
  "bg-chart-4 text-primary-foreground",
  "bg-chart-5 text-night-foreground",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0] ?? "";
  const last = parts[parts.length - 1] ?? "";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase();
}

export function UserAvatar({
  name,
  seed,
  size = "md",
  className,
}: {
  name: string;
  seed: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = { sm: "size-8 text-xs", md: "size-11 text-sm", lg: "size-16 text-xl" };
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-display font-semibold",
        sizes[size],
        AVATAR_TONES[hash(seed) % AVATAR_TONES.length],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function GroupAvatar({ names, seed, size = "md" }: { names: string[]; seed: string; size?: "md" | "lg" }) {
  const box = size === "lg" ? "size-16" : "size-11";
  const [a, b] = names;
  return (
    <span aria-hidden="true" className={cn("relative inline-block shrink-0", box)}>
      <UserAvatar name={a ?? "?"} seed={seed + "a"} size="sm" className="absolute left-0 top-0 ring-2 ring-background" />
      <UserAvatar name={b ?? "+"} seed={seed + "b"} size="sm" className="absolute bottom-0 right-0 ring-2 ring-background" />
    </span>
  );
}

export function GoogleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  );
}

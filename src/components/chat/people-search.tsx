import { useQuery } from "@tanstack/react-query";
import { Check, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/chat";
import { memberName } from "@/lib/chat";
import { normalizeUsername } from "@/lib/usernames";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./brand";

function useDebounced<T>(value: T, ms = 220) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function PeopleSearch({
  meId,
  selected,
  onPick,
  excludeIds = [],
}: {
  meId: string;
  selected?: string[];
  onPick: (p: Profile) => void;
  excludeIds?: string[];
}) {
  const [term, setTerm] = useState("");
  const q = useDebounced(term.trim());

  const { data = [], isFetching } = useQuery({
    queryKey: ["people", q],
    enabled: q.length >= 2,
    queryFn: async () => {
      const handle = normalizeUsername(q);
      const safe = q.replace(/[%_,()]/g, " ");
      const filters = [`display_name.ilike.%${safe}%`];
      if (handle) filters.push(`username.ilike.${handle}%`);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .or(filters.join(","))
        .neq("id", meId)
        .limit(12);
      if (error) throw error;
      return data as Profile[];
    },
  });

  const results = data.filter((p) => !excludeIds.includes(p.id));

  return (
    <div className="grid gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search @username or name"
          className="h-11 rounded-full pl-10"
          autoCapitalize="none"
        />
      </div>
      <div className="max-h-72 min-h-24 overflow-y-auto scrollbar-thin">
        {q.length < 2 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">Type at least 2 letters to find friends.</p>
        ) : results.length === 0 && !isFetching ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">No one by that name yet. Send them your invite link!</p>
        ) : (
          <ul className="grid gap-1">
            {results.map((p) => {
              const isSel = selected?.includes(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onPick(p)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-colors hover:bg-accent",
                      isSel && "bg-accent",
                    )}
                  >
                    <UserAvatar name={memberName(p)} seed={p.id} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{memberName(p)}</span>
                      <span className="block truncate text-xs text-muted-foreground">@{p.username}</span>
                    </span>
                    {isSel && <Check className="size-4 text-primary" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

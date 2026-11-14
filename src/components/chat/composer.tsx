import { ImagePlus, SendHorizonal, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const MAX_BYTES = 10 * 1024 * 1024;

export function Composer({ onSend, disabled }: { onSend: (body: string, file: File | null) => Promise<boolean>; disabled?: boolean }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [text]);

  const canSend = (text.trim().length > 0 || !!file) && !sending && !disabled;

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!canSend) return;
    setSending(true);
    const ok = await onSend(text.trim(), file);
    setSending(false);
    if (ok) {
      setText("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      taRef.current?.focus();
    }
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <form onSubmit={submit} className="border-t border-border bg-panel/80 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
      {preview && (
        <div className="relative mb-2 ml-12 w-fit animate-rise">
          <img src={preview} alt="Photo to send" className="h-24 rounded-2xl border border-border object-cover" />
          <button
            type="button"
            onClick={() => setFile(null)}
            className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-foreground text-background shadow-soft"
            aria-label="Remove photo"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            if (f && f.size > MAX_BYTES) {
              toast.error("Photos can be up to 10 MB");
              e.target.value = "";
              return;
            }
            setFile(f);
          }}
        />
        <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0 text-muted-foreground" onClick={() => fileRef.current?.click()} aria-label="Attach a photo">
          <ImagePlus className="!size-5" />
        </Button>
        <textarea
          ref={taRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          maxLength={4000}
          placeholder="Write a message…"
          aria-label="Message"
          className="max-h-40 min-h-11 flex-1 resize-none rounded-3xl border border-input bg-card px-4 py-2.5 text-[15px] leading-6 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
        <Button type="submit" variant="lantern" size="icon" className="size-11 shrink-0" disabled={!canSend} aria-label="Send">
          <SendHorizonal className="!size-5" />
        </Button>
      </div>
    </form>
  );
}

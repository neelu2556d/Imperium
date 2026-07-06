"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import ImperiumGem from "@/components/welcome/ImperiumGem";
import { getDisplayName } from "@/lib/supabase/dashboard";
import {
  fetchMentorHistory,
  getMentorSession,
  type MentorMessage,
} from "@/lib/supabase/mentor";

/** The quick-prompt chips shown in the Actions row and the welcome card. */
const QUICK_PROMPTS = [
  "Today's session",
  "How am I progressing?",
  "Adjust my macros",
  "Am I recovered?",
];

/** A small static faceted gem, used as the avatar beside each mentor bubble. */
function GemMark({ size = 18 }: { size?: number }) {
  const height = Math.round((size * 150) / 120);
  return (
    <svg
      viewBox="0 0 120 150"
      width={size}
      height={height}
      aria-hidden="true"
      className="shrink-0"
      style={{ filter: "drop-shadow(0 0 6px var(--color-mint-glow))" }}
    >
      <polygon points="60,8 22,46 60,72" fill="var(--color-mint-soft)" />
      <polygon points="60,8 98,46 60,72" fill="var(--color-mint)" />
      <polygon points="22,46 32,112 60,72" fill="var(--color-mint-deep)" />
      <polygon points="98,46 88,112 60,72" fill="var(--color-mint-hover)" />
      <polygon points="32,112 60,132 60,72" fill="var(--color-mint)" />
      <polygon points="88,112 60,132 60,72" fill="var(--color-mint-deep)" />
    </svg>
  );
}

/** A row of quick-prompt chips; tapping one inserts its text into the input. */
function QuickPrompts({
  onPick,
  className = "",
}: {
  onPick: (text: string) => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {QUICK_PROMPTS.map((prompt) => (
        <button
          key={prompt}
          type="button"
          data-no-vitality
          onClick={() => onPick(prompt)}
          className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-strong transition-colors hover:border-[color:var(--color-mint)] hover:text-white"
          style={{ background: "var(--color-card)" }}
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}

interface ChatItem {
  id: string;
  role: "user" | "mentor";
  content: string;
}

let tempId = 0;
const nextTempId = () => `local-${tempId++}`;

export default function MentorChat() {
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [name, setName] = useState<string>("there");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load the display name + last 50 messages on mount.
  useEffect(() => {
    let cancelled = false;
    Promise.all([getDisplayName(), fetchMentorHistory(50)])
      .then(([displayName, history]) => {
        if (cancelled) return;
        if (displayName) setName(displayName);
        setMessages(history.map((m: MentorMessage) => ({ ...m })));
      })
      .catch(() => {
        /* start empty — the welcome card covers a fresh thread */
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the newest message (or the typing indicator) in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const insertPrompt = useCallback((text: string) => {
    setInput(text);
    inputRef.current?.focus();
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    setError(null);
    setInput("");
    setSending(true);
    setMessages((prev) => [
      ...prev,
      { id: nextTempId(), role: "user", content: text },
    ]);

    try {
      const { userId, accessToken } = await getMentorSession();
      const res = await fetch("/api/mentor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ message: text, userId }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.reply) {
        throw new Error(data?.error || "Something went wrong. Try again.");
      }

      setMessages((prev) => [
        ...prev,
        { id: nextTempId(), role: "mentor", content: String(data.reply) },
      ]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again."
      );
    } finally {
      setSending(false);
    }
  }, [input, sending]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void send();
  };

  const showWelcome = loaded && messages.length === 0;

  return (
    <div className="mx-auto flex h-[calc(100dvh-5rem)] w-full max-w-2xl flex-col px-4">
      {/* Top bar */}
      <header className="flex items-center gap-2.5 py-3">
        <ImperiumGem
          size={20}
          showChevron={false}
          className="mentor-gem-glow"
          style={{ gap: 0 } as CSSProperties}
        />
        <div className="flex flex-col leading-none">
          <span className="serif-italic text-xl text-white">Imperium</span>
          <span className="mt-0.5 text-[0.7rem] text-muted">your coach</span>
        </div>
      </header>

      {/* Message list */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto py-4"
        aria-live="polite"
      >
        {showWelcome && (
          <div className="vt-rise-in space-y-4">
            <div className="flex items-start gap-2">
              <GemMark />
              <div className="card max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed text-white">
                Hey {name}. I&apos;ve got your data loaded. Ask me anything —
                your session, your recovery, your progress. I&apos;m here.
              </div>
            </div>
            <QuickPrompts onPick={insertPrompt} className="pl-7" />
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="vt-rise-in flex justify-end">
              <div
                className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
                style={{
                  background: "var(--color-mint)",
                  color: "var(--color-mint-ink)",
                }}
              >
                {m.content}
              </div>
            </div>
          ) : (
            <div key={m.id} className="vt-rise-in flex items-start gap-2">
              <GemMark />
              <div className="card max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed text-white">
                {m.content}
              </div>
            </div>
          )
        )}

        {/* Typing indicator */}
        {sending && (
          <div className="flex items-start gap-2">
            <GemMark />
            <div className="card flex items-center gap-1.5 rounded-2xl px-4 py-3.5">
              <span className="mentor-dot" />
              <span className="mentor-dot" />
              <span className="mentor-dot" />
            </div>
          </div>
        )}
      </div>

      {/* Error line */}
      {error && (
        <p
          role="alert"
          className="px-1 pb-1 text-xs"
          style={{ color: "var(--color-red)" }}
        >
          {error}
        </p>
      )}

      {/* Actions row */}
      <QuickPrompts onPick={insertPrompt} className="pb-2.5" />

      {/* Input bar */}
      <form onSubmit={onSubmit} className="flex items-center gap-2 pb-3">
        <div
          className="flex flex-1 items-center rounded-full border border-border px-2"
          style={{ background: "var(--color-card)" }}
        >
          <input
            ref={inputRef}
            data-no-vitality
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your coach…"
            aria-label="Message your coach"
            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-white outline-none placeholder:text-[color:var(--color-muted)]"
          />
          <button
            type="button"
            data-no-vitality
            aria-label="Voice input (coming soon)"
            title="Voice input — coming soon"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:text-white"
          >
            <MicIcon />
          </button>
        </div>
        <button
          type="submit"
          data-no-vitality
          disabled={!input.trim() || sending}
          aria-label="Send message"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-40"
          style={{ background: "var(--color-mint)", color: "var(--color-mint-ink)" }}
        >
          <SendIcon />
        </button>
      </form>
    </div>
  );
}

function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <path d="M12 17v4" />
    </svg>
  );
}

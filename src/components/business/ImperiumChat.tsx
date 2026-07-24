"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import ImperiumGem from "@/components/welcome/ImperiumGem";
import { fetchAllParties, type PartyRow } from "@/lib/supabase/parties";
import {
  clearBusinessMentorHistory,
  fetchBusinessMentorHistory,
  getBusinessMentorSession,
  type BusinessMentorMessage,
  type ContextType,
} from "@/lib/supabase/businessMentor";

/** The context mode pills shown above the chat input. */
const CONTEXT_MODES: { key: ContextType; label: string }[] = [
  { key: "morning_briefing", label: "Morning Briefing" },
  { key: "pre_visit", label: "Pre-Visit Brief" },
  { key: "post_day", label: "Post-Day" },
  { key: "chat", label: "Chat" },
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

interface ChatItem {
  id: string;
  role: "user" | "mentor";
  content: string;
}

let tempId = 0;
const nextTempId = () => `local-${tempId++}`;

export default function ImperiumChat() {
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [contextType, setContextType] = useState<ContextType>("chat");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Party search state (for pre-visit brief)
  const [parties, setParties] = useState<PartyRow[]>([]);
  const [partySearch, setPartySearch] = useState("");
  const [partyDropdownOpen, setPartyDropdownOpen] = useState(false);
  const [partySelected, setPartySelected] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const partySearchRef = useRef<HTMLInputElement>(null);

  // Load last 30 messages on mount.
  useEffect(() => {
    let cancelled = false;
    fetchBusinessMentorHistory(30)
      .then((history) => {
        if (!cancelled) {
          setMessages(history.map((m: BusinessMentorMessage) => ({ ...m })));
        }
      })
      .catch(() => {
        /* start empty */
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the newest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  // Load parties when pre-visit is selected.
  useEffect(() => {
    if (contextType === "pre_visit" && parties.length === 0) {
      fetchAllParties()
        .then(setParties)
        .catch(() => {});
    }
  }, [contextType, parties.length]);

  // Focus party search when switching to pre-visit.
  useEffect(() => {
    if (contextType === "pre_visit" && !partySelected) {
      partySearchRef.current?.focus();
    }
  }, [contextType, partySelected]);

  const handleContextSwitch = useCallback((newType: ContextType) => {
    setContextType(newType);
    setPartySearch("");
    setPartySelected(false);
    setPartyDropdownOpen(false);
    setInput("");
  }, []);

  const handlePartySelect = useCallback(
    (party: PartyRow) => {
      setPartySearch(party.partyName);
      setPartySelected(true);
      setPartyDropdownOpen(false);

      // Auto-fire the pre-visit API call.
      void sendPartyBrief(party.partyName);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const sendPartyBrief = useCallback(
    async (partyName: string) => {
      if (sending) return;
      setError(null);
      setSending(true);
      setMessages((prev) => [
        ...prev,
        {
          id: nextTempId(),
          role: "user",
          content: `Pre-visit brief for ${partyName}`,
        },
      ]);

      try {
        const { userId, accessToken } = await getBusinessMentorSession();
        const res = await fetch("/api/business-mentor", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            message: partyName,
            userId,
            contextType: "pre_visit",
          }),
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
          err instanceof Error
            ? err.message
            : "Something went wrong. Try again."
        );
      } finally {
        setSending(false);
      }
    },
    [sending]
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    // For pre-visit, the message is the party name if not yet selected.
    const effectiveContextType: ContextType =
      contextType === "pre_visit" && !partySelected ? "pre_visit" : contextType;
    const effectiveMessage =
      contextType === "pre_visit" && !partySelected ? text : text;

    setError(null);
    setInput("");
    setSending(true);
    setMessages((prev) => [
      ...prev,
      { id: nextTempId(), role: "user", content: text },
    ]);

    // If pre-visit and user typed a party name directly, auto-search.
    if (contextType === "pre_visit" && !partySelected) {
      const matched = parties.find(
        (p) =>
          p.partyName.toLowerCase().trim() === text.toLowerCase().trim()
      );
      if (matched) {
        setPartySearch(matched.partyName);
        setPartySelected(true);
      }
    }

    try {
      const { userId, accessToken } = await getBusinessMentorSession();
      const res = await fetch("/api/business-mentor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: effectiveMessage,
          userId,
          contextType: effectiveContextType,
        }),
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
        err instanceof Error
          ? err.message
          : "Something went wrong. Try again."
      );
    } finally {
      setSending(false);
    }
  }, [input, sending, contextType, partySelected, parties]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void send();
  };

  const handleClearChat = useCallback(async () => {
    if (!window.confirm("Clear all business mentor messages?")) return;
    try {
      await clearBusinessMentorHistory();
      setMessages([]);
    } catch {
      /* non-fatal */
    }
  }, []);

  const filteredParties =
    partySearch.length > 0
      ? parties.filter((p) =>
          p.partyName.toLowerCase().includes(partySearch.toLowerCase())
        )
      : parties.slice(0, 8);

  const showWelcome = loaded && messages.length === 0;
  const showPartySearch = contextType === "pre_visit" && !partySelected;

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
          <span className="serif-italic text-xl text-fg">Imperium</span>
          <span className="mt-0.5 text-[0.7rem] text-muted">
            business mentor
          </span>
        </div>
        <div className="flex-1" />
        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleClearChat}
            data-no-vitality
            className="rounded-full border border-border px-3 py-1 text-[0.68rem] font-medium text-muted transition-colors hover:text-fg"
            style={{ background: "var(--color-card)" }}
          >
            Clear chat
          </button>
        )}
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
              <div className="card max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed text-fg">
                Your business data is loaded. Ask me anything — sales, stock,
                parties, payments. I&apos;m here.
              </div>
            </div>
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
              <div className="card max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed text-fg">
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

      {/* Context mode pills */}
      <div className="flex gap-2 overflow-x-auto pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CONTEXT_MODES.map(({ key, label }) => {
          const active = contextType === key;
          return (
            <button
              key={key}
              type="button"
              data-no-vitality
              onClick={() => handleContextSwitch(key)}
              className="shrink-0 rounded-full border px-3.5 py-1.5 text-[0.75rem] font-medium transition-colors"
              style={
                active
                  ? {
                      background: "var(--accent)",
                      color: "var(--accent-ink)",
                      borderColor: "var(--accent)",
                    }
                  : {
                      background: "transparent",
                      color: "var(--accent)",
                      borderColor: "var(--accent)",
                    }
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Party search (pre-visit) */}
      {showPartySearch && (
        <div className="relative pb-2.5">
          <div
            className="flex items-center rounded-full border border-border px-3"
            style={{ background: "var(--color-card)" }}
          >
            <SearchIcon />
            <input
              ref={partySearchRef}
              data-no-vitality
              value={partySearch}
              onChange={(e) => {
                setPartySearch(e.target.value);
                setPartyDropdownOpen(true);
              }}
              onFocus={() => setPartyDropdownOpen(true)}
              placeholder="Who are you visiting?"
              aria-label="Search for a party"
              className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-sm text-fg outline-none placeholder:text-[color:var(--color-muted)]"
            />
          </div>
          {partyDropdownOpen && filteredParties.length > 0 && (
            <ul
              className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-48 overflow-y-auto rounded-xl border border-border"
              style={{ background: "var(--color-card)" }}
            >
              {filteredParties.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    data-no-vitality
                    onClick={() => handlePartySelect(p)}
                    className="w-full px-4 py-2.5 text-left text-sm text-fg transition-colors hover:bg-[color:var(--color-muted)]/10"
                  >
                    {p.partyName}
                    {p.area ? (
                      <span className="ml-2 text-xs text-muted">
                        {p.area}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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
            placeholder={
              contextType === "morning_briefing"
                ? "Ask for a briefing…"
                : contextType === "pre_visit"
                  ? "Ask about this party…"
                  : contextType === "post_day"
                    ? "Ask about today…"
                    : "Ask about your business…"
            }
            aria-label="Message your business mentor"
            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-fg outline-none placeholder:text-[color:var(--color-muted)]"
          />
        </div>
        <button
          type="submit"
          data-no-vitality
          disabled={!input.trim() || sending}
          aria-label="Send message"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-40"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
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

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-muted"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

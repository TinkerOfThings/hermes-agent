import { useEffect, useState } from "react";
import { api, type SessionMessage } from "@/lib/api";
import { Markdown } from "@/components/Markdown";

/**
 * A DOM-rendered, OS-selectable transcript of a chat session — the readable
 * alternative to the raw xterm-buffer dump for copying on mobile (GH #50075).
 * Pulls the persisted messages over REST (no xterm parsing) and renders them
 * with the shared Markdown renderer, so code blocks and formatting survive and
 * any range can be selected/copied.
 *
 * Snapshot only: it shows the persisted history at open time. A turn that is
 * still streaming may not appear until it's saved — live folding is a follow-up.
 */
function roleLabel(role: string): string {
  return role === "user"
    ? "You"
    : role === "assistant"
      ? "Hermes"
      : role === "tool"
        ? "Tool"
        : role;
}

function plainText(messages: SessionMessage[]): string {
  return messages
    .map((m) => {
      const calls = (m.tool_calls || [])
        .map((tc) => `  -> ${tc.function.name}(${tc.function.arguments})`)
        .join("\n");
      const body = m.content || (m.tool_name ? `(${m.tool_name})` : "");
      return [`${roleLabel(m.role)}:`, calls, body].filter(Boolean).join("\n");
    })
    .join("\n\n");
}

export function ChatTranscript({
  sessionId,
  profile,
  onText,
}: ChatTranscriptProps) {
  const [messages, setMessages] = useState<SessionMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMessages(null);
    setError(null);
    api
      .getSessionMessages(sessionId, profile)
      .then((r) => {
        if (cancelled) return;
        const msgs = r.messages || [];
        setMessages(msgs);
        onText?.(plainText(msgs));
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
    // onText is a setter from the parent — stable; excluded to avoid refetch loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, profile]);

  if (error) {
    return (
      <div className="p-3 text-xs text-white/60">
        Couldn't load the transcript ({error}). Long-press again for the raw view.
      </div>
    );
  }
  if (!messages) {
    return <div className="p-3 text-xs text-white/60">Loading transcript…</div>;
  }
  if (!messages.length) {
    return <div className="p-3 text-xs text-white/60">No messages in this session yet.</div>;
  }

  return (
    <div
      className="min-h-0 flex-1 overflow-auto px-3 pb-3"
      style={{ WebkitUserSelect: "text", userSelect: "text" }}
    >
      {messages.map((m, i) => (
        <div key={i} className="border-b border-white/10 py-2 last:border-0">
          <div
            className={`mb-1 text-[11px] font-semibold uppercase tracking-wide ${
              m.role === "user"
                ? "text-sky-300"
                : m.role === "assistant"
                  ? "text-emerald-300"
                  : "text-white/40"
            }`}
          >
            {roleLabel(m.role)}
          </div>

          {(m.tool_calls || []).map((tc, j) => (
            <pre
              key={j}
              className="mb-1 overflow-x-auto rounded bg-white/5 p-2 text-[11px] text-white/70"
            >
              {tc.function.name}({tc.function.arguments})
            </pre>
          ))}

          {m.content ? (
            <div className="text-sm text-white/90">
              <Markdown content={m.content} />
            </div>
          ) : m.tool_name ? (
            <div className="text-[11px] text-white/50">↳ {m.tool_name}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

interface ChatTranscriptProps {
  sessionId: string;
  profile?: string;
  /** Reports the flattened plain-text transcript (for a "Copy all" button). */
  onText?: (text: string) => void;
}

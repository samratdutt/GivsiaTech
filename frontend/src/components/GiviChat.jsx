import { useState, useRef, useEffect } from "react";
import api from "../api/axios.js";

const GREETING = {
  role: "assistant",
  content: "👋 Welcome to GivsiaTech! I'm Givi, your site guide — ask me anything, or I can walk you through what we offer and help you find where to start.",
};

const SUGGESTIONS = [
  "What can you help me with?",
  "What services do you offer?",
  "Show me your pricing",
  "Tell me about your work",
];

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 4v6h-6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export default function GiviChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef();
  const inputRef = useRef();

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open, loading]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const sendText = async (text) => {
    if (!text || loading) return;

    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      // Skip the static greeting at index 0 — the API requires the first
      // message in the array to have role "user".
      const { data } = await api.post("/chat/givi", { messages: nextMessages.slice(1) });
      setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setMessages([
        ...nextMessages,
        { role: "assistant", content: "I'm having trouble connecting right now — try the contact form below instead." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const send = (e) => {
    e.preventDefault();
    sendText(input.trim());
  };

  const startNewChat = () => {
    setMessages([GREETING]);
    setInput("");
    setLoading(false);
  };

  const freshConversation = messages.length === 1;

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`chat-fab${open ? "" : " chat-fab-pulse"}`}
        style={styles.fab}
        aria-label={open ? "Close Givi chat" : "Open Givi chat"}
      >
        {open ? <CloseIcon /> : "G"}
        {!open && <span className="chat-fab-dot" aria-hidden="true" />}
      </button>

      {open && (
        <div className="chat-panel" style={styles.panel}>
          <div style={styles.header}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "0.95rem" }}>Givi</span>
              <span style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>AI assistant</span>
            </div>
            <button
              type="button"
              onClick={startNewChat}
              className="chat-icon-btn chat-refresh-btn"
              style={styles.iconBtn}
              title="Start a new conversation"
              aria-label="Start a new conversation"
              disabled={freshConversation}
            >
              <RefreshIcon />
            </button>
          </div>

          <div ref={scrollRef} style={styles.messages}>
            {messages.map((m, i) => (
              <div key={i} className="chat-bubble-in" style={m.role === "user" ? styles.bubbleUser : styles.bubbleBot}>
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="chat-bubble-in" style={styles.bubbleBot}>
                <span className="chat-typing-dots"><span /><span /><span /></span>
              </div>
            )}

            {freshConversation && !loading && (
              <div style={styles.suggestionWrap}>
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" className="chat-suggestion-chip" onClick={() => sendText(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={send} style={styles.inputRow}>
            <input
              ref={inputRef}
              placeholder="Ask Givi something..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" type="submit" disabled={loading || !input.trim()} style={{ padding: "10px 16px" }}>
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}

const styles = {
  fab: {
    position: "fixed",
    bottom: 28,
    right: 28,
    width: 56,
    height: 56,
    borderRadius: "50%",
    background: "linear-gradient(135deg, var(--yellow), var(--yellow-soft))",
    color: "#1a1410",
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: "1.1rem",
    boxShadow: "0 8px 24px rgba(var(--yellow-rgb), 0.35)",
    zIndex: 100,
    transition: "background 0.4s ease, box-shadow 0.4s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  panel: {
    position: "fixed",
    bottom: 96,
    right: 28,
    width: 340,
    maxHeight: 480,
    background: "rgba(var(--surface-rgb), 0.85)",
    backdropFilter: "blur(18px) saturate(160%)",
    WebkitBackdropFilter: "blur(18px) saturate(160%)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    zIndex: 100,
    boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
    transition: "background 0.4s ease, border-color 0.4s ease",
  },
  header: {
    padding: "14px 18px",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: { padding: 4, display: "flex", lineHeight: 0 },
  messages: { flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10, minHeight: 240 },
  bubbleUser: {
    alignSelf: "flex-end",
    background: "var(--lavender-deep)",
    color: "#fff",
    padding: "9px 13px",
    borderRadius: "12px 12px 2px 12px",
    fontSize: "0.85rem",
    maxWidth: "85%",
  },
  bubbleBot: {
    alignSelf: "flex-start",
    background: "var(--bg-soft)",
    border: "1px solid var(--border)",
    padding: "9px 13px",
    borderRadius: "12px 12px 12px 2px",
    fontSize: "0.85rem",
    maxWidth: "85%",
  },
  suggestionWrap: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 },
  inputRow: { display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--border)" },
};

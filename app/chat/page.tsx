"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TimeClient from "../components/TimeClient";

// Types for chat messages compatible with OpenAI-like APIs
export type ChatRole = "user" | "assistant" | "system";
export type ChatMessage = { role: ChatRole; content: string; createdAt?: number };

export default function ChatPage() {
  // Avoid non-deterministic timestamps during SSR to prevent hydration mismatch
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Xin chào! Hãy bắt đầu trò chuyện nhé 👋" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [persist, setPersist] = useState<boolean>(true);
  const [showSystem, setShowSystem] = useState<boolean>(false);
  const [systemPrompt, setSystemPrompt] = useState<string>("");
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState<boolean>(true);

  // Theme handlers
  const applyTheme = useCallback((t: "light" | "dark") => {
    const root = document.documentElement;
    if (t === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("theme", t);
  }, []);

  useEffect(() => {
    setMounted(true);
    // Theme
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    let initial: "light" | "dark" = "light";
    if (saved) {
      initial = saved;
    } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      initial = "dark";
    }
    setTheme(initial);
    applyTheme(initial);

    // Persistence toggle
    const savedPersist = localStorage.getItem("chat_persist");
    if (savedPersist !== null) {
      setPersist(savedPersist === "1");
    }

    // Load messages if persisted
    const raw = localStorage.getItem("chat_messages");
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Migration: ensure createdAt exists for old records
          const now = Date.now();
          const migrated = parsed.map((m, i) =>
            m.createdAt ? m : { ...m, createdAt: now + i }
          );
          setMessages(migrated);
        }
      } catch {
        // ignore parse errors
      }
    }

    // Load system prompt
    const sp = localStorage.getItem("chat_system_prompt");
    if (sp) setSystemPrompt(sp);

    // Check token health
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => setHasToken(data.hasToken ?? true))
      .catch(() => setHasToken(true)); // Assume OK on error
  }, [applyTheme]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    if (autoScroll) {
      scrollToBottom("smooth");
    }
  }, [messages, loading, autoScroll, scrollToBottom]);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  // Persist messages when they change
  useEffect(() => {
    if (!mounted) return;
    if (persist) {
      try {
        // Keep only last 200 messages to avoid quota errors
        const toSave = messages.slice(-200);
        localStorage.setItem("chat_messages", JSON.stringify(toSave));
      } catch {
        // ignore quota errors
      }
    } else {
      localStorage.removeItem("chat_messages");
    }
  }, [messages, persist, mounted]);

  // Persist system prompt
  useEffect(() => {
    if (!mounted) return;
    try {
      if (systemPrompt.trim()) localStorage.setItem("chat_system_prompt", systemPrompt);
      else localStorage.removeItem("chat_system_prompt");
    } catch {}
  }, [systemPrompt, mounted]);

  async function sendMessage(textOverride?: string) {
    const content = (textOverride ?? input).trim();
    if (!content || loading) return;

    const userMsg: ChatMessage = { role: "user", content, createdAt: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    if (!textOverride) setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...(systemPrompt.trim() ? [{ role: "system", content: systemPrompt }] : []),
            ...messages,
            userMsg,
          ],
          model: "deepseek-chat@DeepSeek",
          max_tokens: 256,
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || `Request failed (${res.status})`);
      }

      // Try to read content like OpenAI: data.choices[0].message.content
      let assistantText = "";
      const data = payload?.data;
      if (data?.choices?.[0]?.message?.content) {
        assistantText = String(data.choices[0].message.content);
      } else if (data?.choices?.[0]?.text) {
        assistantText = String(data.choices[0].text);
      } else if (typeof data?.content === "string") {
        assistantText = data.content;
      } else if (typeof data?.raw === "string") {
        assistantText = data.raw;
      } else {
        assistantText = JSON.stringify(data);
      }

  setMessages((prev) => [...prev, { role: "assistant", content: assistantText, createdAt: Date.now() }]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Đã có lỗi xảy ra";
      setError(message);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ Lỗi: ${message}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  }

  function clearChat() {
    // Client-only action; using Date.now() here is safe
    setMessages([{ role: "assistant", content: "Xin chào! Hãy bắt đầu trò chuyện nhé 👋", createdAt: Date.now() }]);
    setError(null);
    setTimeout(() => scrollToBottom("auto"), 0);
  }

  function onScrollContainer() {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 80; // px threshold
    setAutoScroll(nearBottom);
  }

  const suggestions = [
    "Giới thiệu tính năng của bạn",
    "Tóm tắt đoạn văn này",
    "Viết email xin nghỉ phép",
    "Gợi ý ý tưởng nội dung",
  ] as const;

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopyFeedback("Đã copy!");
    setTimeout(() => setCopyFeedback(null), 2000);
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col p-4">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm">
          {/* Simple bot icon */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="7" width="18" height="13" rx="4"/>
            <path d="M7 7V5a5 5 0 0 1 10 0v2"/>
            <circle cx="9" cy="13" r="1.5"/>
            <circle cx="15" cy="13" r="1.5"/>
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-semibold leading-tight">Chatbot</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Hỏi đáp nhanh, tiếng Việt mượt mà</p>
            <div className="mt-1 inline-flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white/70 px-2 py-0.5 text-[10px] text-zinc-600 shadow-sm dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-300">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                deepseek-chat@DeepSeek
              </span>
              {!hasToken && (
                <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50/70 px-2 py-0.5 text-[10px] text-red-600 shadow-sm dark:border-red-800 dark:bg-red-900/40 dark:text-red-300">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  Thiếu token
                </span>
              )}
            </div>
        </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearChat}
            className="rounded-lg border border-zinc-200 bg-white/70 px-3 py-1.5 text-sm shadow-sm transition hover:bg-white dark:border-zinc-700 dark:bg-zinc-800/70 dark:hover:bg-zinc-800"
          >
            Xóa hội thoại
          </button>
          {mounted && (
            <button
              onClick={() => {
                const next = !persist;
                setPersist(next);
                localStorage.setItem("chat_persist", next ? "1" : "0");
                if (!next) localStorage.removeItem("chat_messages");
              }}
              className={`grid h-9 w-9 place-items-center rounded-lg border text-zinc-700 shadow-sm transition dark:text-zinc-200 ${
                persist
                  ? "border-emerald-300/60 bg-emerald-50/70 hover:bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-900/40 dark:hover:bg-emerald-900/50"
                  : "border-zinc-200 bg-white/70 hover:bg-white dark:border-zinc-700 dark:bg-zinc-800/70 dark:hover:bg-zinc-800"
              }`}
              title={persist ? "Đang lưu trên trình duyệt" : "Không lưu lịch sử"}
            >
              {/* Bookmark icon indicating persistence */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </button>
          )}
          {mounted && (
            <button
              onClick={() => {
                const next = theme === "dark" ? "light" : "dark";
                setTheme(next);
                applyTheme(next);
              }}
              className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-200 bg-white/70 text-zinc-700 shadow-sm transition hover:bg-white dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-200 dark:hover:bg-zinc-800"
              title={theme === "dark" ? "Chuyển sáng" : "Chuyển tối"}
            >
              {theme === "dark" ? (
                // Sun icon
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                // Moon icon
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
          )}
          <button
            onClick={() => setShowSystem((v) => !v)}
            className="hidden sm:grid h-9 w-9 place-items-center rounded-lg border border-zinc-200 bg-white/70 text-zinc-700 shadow-sm transition hover:bg-white dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-200 dark:hover:bg-zinc-800"
            title="System prompt"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
        </div>
      </header>

      {showSystem && (
        <div className="mb-3 rounded-xl border border-zinc-200/80 bg-white/80 p-3 text-xs shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-zinc-800 dark:bg-zinc-900/70 dark:supports-[backdrop-filter]:bg-zinc-900/50">
          <label className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300">System prompt (tùy chọn)</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Ví dụ: Bạn là trợ lý thân thiện, trả lời ngắn gọn."
            rows={2}
            className="w-full resize-y rounded-lg border border-transparent bg-zinc-50/60 p-2 leading-6 outline-none focus:border-blue-500 dark:bg-zinc-800/60"
          />
          <p className="mt-1 text-[10px] text-zinc-500">Nội dung này sẽ được gửi ẩn với vai trò &#39;system&#39; để định hướng câu trả lời.</p>
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={onScrollContainer}
        className="relative flex-1 overflow-y-auto rounded-2xl border border-zinc-200/70 bg-white/70 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-zinc-800 dark:bg-zinc-900/60 dark:supports-[backdrop-filter]:bg-zinc-900/50"
      >
        {messages.length === 0 ? (
          <p className="text-zinc-500">Chưa có tin nhắn.</p>
        ) : (
          <ul className="space-y-4">
            {messages.map((m, idx) => {
              // Date separator logic
              const curr = m.createdAt ? new Date(m.createdAt) : null;
              const prev = messages[idx - 1]?.createdAt
                ? new Date(messages[idx - 1].createdAt as number)
                : null;
              const isNewDay =
                !!curr && (!!prev ? curr.toDateString() !== prev.toDateString() : true);

              function formatDateLabel(d: Date): string {
                const today = new Date();
                const yesterday = new Date();
                yesterday.setDate(today.getDate() - 1);
                if (d.toDateString() === today.toDateString()) return "Hôm nay";
                if (d.toDateString() === yesterday.toDateString()) return "Hôm qua";
                return d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" });
              }

              return (
                <li key={idx} className="flex flex-col gap-2">
                  {isNewDay && curr && (
                    <div className="sticky top-2 z-10 mb-1 flex items-center justify-center">
                      <span suppressHydrationWarning className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-3 py-1 text-[10px] tracking-wide text-zinc-600 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-300">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2"/>
                          <line x1="16" y1="2" x2="16" y2="6"/>
                          <line x1="8" y1="2" x2="8" y2="6"/>
                        </svg>
                        {formatDateLabel(curr)}
                      </span>
                    </div>
                  )}
                  {m.role === "user" ? (
                    <div className="ml-auto flex items-end gap-2">
                      <div className="group relative ml-auto max-w-[88%] sm:max-w-[82%] lg:max-w-[72%] rounded-2xl rounded-tr-md bg-gradient-to-br from-blue-600 to-indigo-600 px-4 py-3 text-white shadow-md">
                        <button
                          onClick={() => handleCopy(m.content)}
                          className="absolute right-1 top-1 hidden rounded px-1.5 py-0.5 text-[10px] opacity-80 ring-1 ring-white/40 hover:opacity-100 group-hover:block"
                          title="Copy"
                        >
                          Copy
                        </button>
                        <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                        {m.createdAt && (
                          <TimeClient timestamp={m.createdAt} className="mt-1 text-[10px] opacity-80" />
                        )}
                      </div>
                      <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm">
                        <span className="text-[10px] font-medium">U</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mr-auto flex items-end gap-2">
                      <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-sm">
                        {/* Bot mini icon */}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="7" width="18" height="13" rx="4"/>
                          <circle cx="9" cy="13" r="1.5"/>
                          <circle cx="15" cy="13" r="1.5"/>
                        </svg>
                      </div>
                      <div className="group relative max-w-[88%] sm:max-w-[82%] lg:max-w-[72%] rounded-2xl rounded-tl-md border border-zinc-200 bg-white px-4 py-3 text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
                        <button
                          onClick={() => handleCopy(m.content)}
                          className="absolute right-1 top-1 hidden rounded px-1.5 py-0.5 text-[10px] opacity-70 ring-1 ring-zinc-300 hover:opacity-100 group-hover:block dark:ring-zinc-600"
                          title="Copy"
                        >
                          Copy
                        </button>
                        <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                        {m.createdAt && (
                          <TimeClient timestamp={m.createdAt} className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400" />
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
            {loading && (
              <li className="flex">
                <div className="mr-auto max-w-[88%] sm:max-w-[82%] lg:max-w-[72%] rounded-2xl rounded-tl-md border border-zinc-200 bg-white px-4 py-3 text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
                  <span className="typing-dots text-zinc-500 dark:text-zinc-400">
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                  </span>
                </div>
              </li>
            )}
          </ul>
        )}
        <div ref={bottomRef} />
        {!autoScroll && (
          <button
            onClick={() => {
              setAutoScroll(true);
              scrollToBottom("smooth");
            }}
            className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/90 px-3 py-1.5 text-xs shadow-sm backdrop-blur transition hover:bg-white dark:border-zinc-700 dark:bg-zinc-800/90 dark:hover:bg-zinc-800"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="7 13 12 18 17 13" />
              <polyline points="7 6 12 11 17 6" />
            </svg>
            Xuống cuối
          </button>
        )}
      </div>

      {/* Quick suggestions */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {suggestions.map((s, idx) => (
          <button
            key={idx}
            onClick={() => sendMessage(s)}
            disabled={loading}
            className="rounded-full border border-zinc-200 bg-white/70 px-3 py-1 text-xs shadow-sm transition hover:bg-white disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800/70 dark:hover:bg-zinc-800"
          >
            {s}
          </button>
        ))}
      </div>
      <div className="sticky bottom-0 mt-2 flex items-end gap-2 rounded-xl border border-zinc-200/80 bg-white/80 p-2 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-zinc-800 dark:bg-zinc-900/70 dark:supports-[backdrop-filter]:bg-zinc-900/50">
        <textarea
          ref={textareaRef}
          className="min-h-[48px] max-h-[200px] flex-1 resize-none overflow-y-auto rounded-lg bg-transparent p-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Nhập tin nhắn... (Enter để gửi, Shift+Enter xuống dòng)"
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          rows={2}
        />
        <button
          onClick={() => sendMessage()}
          disabled={!canSend}
          className="h-[48px] shrink-0 rounded-lg bg-blue-600 px-4 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="inline-flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            Gửi
          </span>
        </button>
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}

      {copyFeedback && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white shadow-lg">
          {copyFeedback}
        </div>
      )}

      <p className="mt-3 text-xs text-zinc-500">
        Mặc định dùng model <code>deepseek-chat@DeepSeek</code>, tối đa 256 tokens. Bạn có thể
        thay đổi logic trong <code>/app/api/chat/route.ts</code>.
      </p>
    </div>
  );
}

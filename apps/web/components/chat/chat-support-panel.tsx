"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type MessageAuthor = "player" | "support";

type Message = {
  id: number;
  author: MessageAuthor;
  body: string;
  timestamp: string;
};

const supportReplies = [
  "Thanks for reaching out! We keep the queue light during the MVP, so you can expect responses within a minute.",
  "If you're troubleshooting an invoice, share the payment hash and we can verify it across our Lightning node logs.",
  "Need a fresh download link? Let me know the game title and we'll regenerate the secure URL for you right away.",
];

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function ChatSupportPanel(): JSX.Element {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      author: "support",
      body: "Welcome to Bit Indie support! Ask anything about Lightning checkout, downloads, or your developer console.",
      timestamp: formatTimestamp(new Date()),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const replyIndexRef = useRef(0);

  useEffect(() => {
    if (!listRef.current) {
      return;
    }

    listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function queueSupportReply(): void {
    setTimeout(() => {
      const reply = supportReplies[replyIndexRef.current % supportReplies.length];
      replyIndexRef.current += 1;

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + replyIndexRef.current,
          author: "support",
          body: reply,
          timestamp: formatTimestamp(new Date()),
        },
      ]);
    }, 450);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const trimmed = inputValue.trim();
    if (!trimmed) {
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        author: "player",
        body: trimmed,
        timestamp: formatTimestamp(new Date()),
      },
    ]);

    setInputValue("");
    queueSupportReply();
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-emerald-500/15 bg-slate-950/60 p-6 shadow-[0_0_35px_rgba(16,185,129,0.2)] backdrop-blur-xl before:pointer-events-none before:absolute before:-inset-px before:rounded-[1.45rem] before:border before:border-emerald-500/15 before:opacity-60">
      <div className="relative z-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">Live chat</p>
          <h2 className="text-2xl font-semibold text-white">Talk with the Bit Indie crew</h2>
          <p className="text-sm text-slate-300">
            Ask about invoices, downloads, or upcoming releases. We monitor this channel during demo windows and respond within a
            minute.
          </p>
        </header>

        <div className="mt-6 h-80 overflow-y-auto pr-2" ref={listRef}>
          <ul className="flex flex-col gap-4">
            {messages.map((message) => {
              const isPlayer = message.author === "player";
              const alignment = isPlayer ? "items-end" : "items-start";
              const bubbleClasses = isPlayer
                ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-50"
                : "bg-slate-900/70 border-slate-700 text-slate-100";

              return (
                <li className={`flex ${alignment}`} key={message.id}>
                  <div className={`max-w-[80%] rounded-2xl border px-4 py-3 shadow-[0_0_22px_rgba(15,118,110,0.25)] ${bubbleClasses}`}>
                    <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-emerald-200/70">
                      {isPlayer ? "You" : "Bit Indie"}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-current">{message.body}</p>
                    <p className="mt-2 text-[0.6rem] uppercase tracking-[0.35em] text-slate-400">{message.timestamp}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <form className="mt-6 flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="chat-input">
            Ask a question
          </label>
          <input
            id="chat-input"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="Ask about payouts, downloads, or publishing"
            className="flex-1 rounded-full border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            autoComplete="off"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full border border-emerald-400/70 bg-emerald-500/20 px-6 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-100 shadow-[0_0_24px_rgba(16,185,129,0.3)] transition hover:border-emerald-300 hover:text-emerald-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

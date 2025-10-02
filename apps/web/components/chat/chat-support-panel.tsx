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
    <div className="relative overflow-hidden rounded-3xl border border-[#7bffc8]/20 bg-[#060606]/90 p-6 shadow-[0_0_45px_rgba(123,255,200,0.18)] backdrop-blur-xl before:pointer-events-none before:absolute before:-inset-px before:rounded-[1.45rem] before:border before:border-[#7bffc8]/25 before:opacity-60">
      <div className="relative z-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-[#7bffc8]/70">Live chat</p>
          <h2 className="text-2xl font-semibold text-white">Talk with the Bit Indie crew</h2>
          <p className="text-sm text-[#dcfff2]/80">
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
                ? "bg-[#7bffc8]/20 border-[#7bffc8]/40 text-[#050505]"
                : "bg-[#0b0b0b]/90 border-white/10 text-[#e8f9f1]";

              return (
                <li className={`flex ${alignment}`} key={message.id}>
                  <div className={`max-w-[80%] rounded-2xl border px-4 py-3 shadow-[0_0_30px_rgba(123,255,200,0.18)] ${bubbleClasses}`}>
                    <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-[#7bffc8]/70">
                      {isPlayer ? "You" : "Bit Indie"}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-current">{message.body}</p>
                    <p className="mt-2 text-[0.6rem] uppercase tracking-[0.35em] text-[#b8ffe5]/60">{message.timestamp}</p>
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
            className="flex-1 rounded-full border border-white/10 bg-[#0b0b0b] px-4 py-3 text-sm text-white placeholder:text-[#7bffc8]/40 transition focus:border-[#7bffc8] focus:outline-none focus:ring-2 focus:ring-[#7bffc8]/40"
            autoComplete="off"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full border border-[#7bffc8]/70 bg-[#7bffc8]/20 px-6 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-white shadow-[0_0_24px_rgba(123,255,200,0.25)] transition hover:border-[#7bffc8] hover:bg-[#7bffc8]/90 hover:text-[#050505]"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

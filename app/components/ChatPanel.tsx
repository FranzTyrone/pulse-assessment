"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DrawCanvas from "./DrawCanvas";
import type { DrawMessage } from "@/lib/types";

export interface ChatMessage {
  id: number;
  mine: boolean;
  text: string;
}

export default function ChatPanel({
  messages = [],
  connected,
  videoBusy,
  onSend,
  onStartVideo,
  onEnd,
  onDraw,
  onClear,
  remoteDrawRef,
  remoteClearRef,
}: {
  messages: ChatMessage[];
  connected: boolean;
  videoBusy: boolean;
  onSend: (text: string) => void;
  onStartVideo: () => void;
  onEnd: () => void;
  onDraw: (msg: DrawMessage) => void;
  onClear: () => void;
  remoteDrawRef: React.MutableRefObject<((msg: DrawMessage) => void) | null>;
  remoteClearRef: React.MutableRefObject<(() => void) | null>;
}) {
  const [draft, setDraft] = useState("");
  const [tab, setTab] = useState<"chat" | "draw">("chat");
  const [color, setColor] = useState("#ffffff");
  const [brushSize, setBrushSize] = useState(4);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !connected) return;
    onSend(text);
    setDraft("");
  }

  return (
    <motion.div
      className="glass absolute inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col shadow-2xl shadow-black/50"
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/8 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-sm font-semibold text-blue-300">
            S
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Stranger</p>
            <div className="flex items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  connected ? "bg-emerald-400" : "bg-yellow-400"
                }`}
              />
              <p className="text-xs text-zinc-500">
                {connected ? "Connected" : "Connecting…"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onStartVideo}
            disabled={!connected || videoBusy}
            title="Start video"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-zinc-400 transition hover:border-white/20 hover:text-white disabled:opacity-30"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="h-4 w-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m15.75 10.5 4.72-4.72v12.44l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9A2.25 2.25 0 0 0 13.5 5.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
          </button>
          <button
            onClick={onEnd}
            title="End connection"
            className="flex h-8 items-center gap-1.5 rounded-full bg-red-500/20 px-3 text-xs font-medium text-red-400 transition hover:bg-red-500/30 hover:text-red-300"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="h-3.5 w-3.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
            End
          </button>
        </div>
      </header>

      {/* Tab switcher */}
      <div className="flex border-b border-white/8">
        {(["chat", "draw"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-medium transition ${
              tab === t
                ? "text-white border-b-2 border-blue-500"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t === "chat" ? "💬 Chat" : "🎨 Draw"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <AnimatePresence mode="wait" initial={false}>
          {tab === "chat" ? (
            <motion.div
              key="chat"
              className="flex-1 overflow-hidden flex flex-col min-h-0"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
              {/* Messages */}
              <div className="chat-scroll flex-1 space-y-2 overflow-y-auto px-4 py-4">
                {messages.length === 0 && (
                  <motion.div
                    className="mt-12 flex flex-col items-center gap-2 text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-lg">
                      👋
                    </div>
                    <p className="text-sm text-zinc-500">Say hello.</p>
                    <p className="text-xs text-zinc-600">
                      Messages are peer-to-peer and never stored.
                    </p>
                  </motion.div>
                )}

                <AnimatePresence initial={false}>
                  {messages.map((m) => (
                    <motion.div
                      key={m.id}
                      className={`flex ${m.mine ? "justify-end" : "justify-start"}`}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 28,
                      }}
                    >
                      <span
                        className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                          m.mine
                            ? "rounded-br-sm bg-blue-500 text-white"
                            : "rounded-bl-sm bg-white/8 text-zinc-100"
                        }`}
                      >
                        {m.text}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={endRef} />
              </div>

              {/* Input */}
              <form
                onSubmit={submit}
                className="flex items-center gap-2 border-t border-white/8 px-3 py-3"
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={connected ? "Message…" : "Connecting…"}
                  disabled={!connected}
                  className="flex-1 rounded-full bg-white/6 px-4 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:ring-1 focus:ring-blue-500/50 disabled:opacity-40 transition"
                />
                <button
                  type="submit"
                  disabled={!connected || !draft.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-400 disabled:opacity-30"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-4 w-4 translate-x-0.5 -rotate-45"
                  >
                    <path d="M3.478 2.405a.75.75 0 0 0-.926.94l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.405Z" />
                  </svg>
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="draw"
              className="flex-1 overflow-hidden flex flex-col min-h-0"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.15 }}
            >
              <DrawCanvas
                color={color}
                brushSize={brushSize}
                onColorChange={setColor}
                onBrushChange={setBrushSize}
                onDraw={onDraw}
                onClear={onClear}
                remoteDrawRef={remoteDrawRef}
                remoteClearRef={remoteClearRef}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

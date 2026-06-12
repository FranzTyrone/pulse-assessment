"use client";

import { motion } from "framer-motion";

export default function ConnectionPrompt({
  title,
  subtitle,
  acceptLabel,
  declineLabel,
  onAccept,
  onDecline,
}: {
  title: string;
  subtitle?: string;
  acceptLabel: string;
  declineLabel: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <motion.div
      className="absolute inset-0 z-20 flex items-center justify-center p-6"
      style={{ background: "rgba(4, 6, 14, 0.7)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="absolute inset-0 backdrop-blur-sm" />
      <motion.div
        className="glass relative w-full max-w-xs rounded-2xl p-6 text-center shadow-2xl shadow-black/60"
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 16 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/15">
          <div className="h-3 w-3 rounded-full bg-blue-400 shadow-lg shadow-blue-400/50" />
        </div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
        <div className="mt-5 flex gap-2">
          <button
            onClick={onDecline}
            className="flex-1 rounded-full border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
          >
            {declineLabel}
          </button>
          <button
            onClick={onAccept}
            className="flex-1 rounded-full bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-400"
          >
            {acceptLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

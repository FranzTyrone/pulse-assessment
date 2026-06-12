"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function EntryGate({
  onReady,
}: {
  onReady: (lat: number, lng: number) => void;
}) {
  const [status, setStatus] = useState<"idle" | "locating" | "error">("idle");
  const [error, setError] = useState<string>("");

  function enter() {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setError("Your browser doesn't support location access.");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => onReady(pos.coords.latitude, pos.coords.longitude),
      (err) => {
        setStatus("error");
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission is required to place you on the map."
            : "Couldn't get your location. Please try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  return (
    <div className="gate-bg flex min-h-full flex-1 flex-col items-center justify-center gap-10 p-6">
      {/* Ambient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-150 w-150  -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/5 blur-3xl" />
        <div className="absolute left-1/4 top-1/3 h-75 w-75 rounded-full bg-violet-500/4 blur-3xl" />
      </div>

      <motion.div
        className="relative text-center"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        {/* Logo mark */}
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-lg shadow-blue-500/10 backdrop-blur">
          <span className="text-2xl">🌐</span>
        </div>

        <h1 className="text-5xl font-bold tracking-tight text-white">Pulse</h1>
        <p className="mt-3 max-w-xs text-base leading-relaxed text-zinc-400">
          A living globe of anonymous strangers.
          <br />
          Drop in. Connect. Disappear.
        </p>
      </motion.div>

      <motion.div
        className="flex flex-col items-center gap-4"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
      >
        <button
          onClick={enter}
          disabled={status === "locating"}
          className="group relative overflow-hidden rounded-full bg-blue-500 px-10 py-3.5 font-semibold text-white shadow-lg shadow-blue-500/25 transition-all duration-200 hover:bg-blue-400 hover:shadow-blue-400/30 disabled:opacity-60"
        >
          {/* Shimmer effect */}
          <span className="absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          <span className="relative flex items-center gap-2">
            {status === "locating" ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Locating…
              </>
            ) : (
              "Enter Pulse"
            )}
          </span>
        </button>

        <AnimatePresence>
          {status === "error" && (
            <motion.p
              className="max-w-sm text-center text-sm text-red-400"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.p
        className="absolute bottom-8 max-w-sm text-center text-xs leading-relaxed text-zinc-600"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.4 }}
      >
        No sign-up. Your dot is placed 1–3&nbsp;km from your real location.
        Nothing is stored — closing the tab ends everything.
      </motion.p>
    </div>
  );
}

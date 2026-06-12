"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { motion } from "framer-motion";
import EntryGate from "./components/EntryGate";
import WorldMap from "./components/WorldMap";
import ConnectionPrompt from "./components/ConnectionPrompt";
import ChatPanel, { type ChatMessage } from "./components/ChatPanel";
import VideoPanel from "./components/VideoPanel";
import { join, leave, poll, sendSignal } from "@/lib/api";
import { PeerSession, type DescType, type PeerControl } from "@/lib/webrtc";
import { POLL_INTERVAL_MS } from "@/lib/presence";
import { type PeerDot, type SignalMsg, type DrawMessage } from "@/lib/types";

type Conn =
  | { kind: "idle" }
  | { kind: "requesting"; peerId: string }
  | { kind: "incoming"; peerId: string }
  | { kind: "connecting"; peerId: string }
  | { kind: "connected"; peerId: string };

type VideoState = "none" | "requesting" | "incoming" | "active";
const REQUEST_TIMEOUT_MS = 30_000;

export default function Home() {
  const [phase, setPhase] = useState<"gate" | "live">("gate");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [peers, setPeers] = useState<PeerDot[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [myLocation, setMyLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [conn, _setConn] = useState<Conn>({ kind: "idle" });
  const connRef = useRef<Conn>(conn);
  const setConn = (c: Conn) => {
    connRef.current = c;
    _setConn(c);
  };

  const [video, _setVideo] = useState<VideoState>("none");
  const videoRef = useRef<VideoState>(video);
  const setVideo = (v: VideoState) => {
    videoRef.current = v;
    _setVideo(v);
  };

  const peerRef = useRef<PeerSession | null>(null);
  const msgId = useRef(0);
  const requestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Draw refs — used to push remote strokes into the canvas without re-rendering
  const remoteDrawRef = useRef<((msg: DrawMessage) => void) | null>(null);
  const remoteClearRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("pulse-session-id");
    if (saved) {
      setSessionId(saved);
    } else {
      const newId = crypto.randomUUID();
      localStorage.setItem("pulse-session-id", newId);
      setSessionId(newId);
    }
  }, []);

  function showNotice(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 3500);
  }

  function addMessage(mine: boolean, text: string) {
    setMessages((prev) => [...prev, { id: msgId.current++, mine, text }]);
  }

  function teardown(message?: string) {
    if (requestTimer.current) clearTimeout(requestTimer.current);
    peerRef.current?.close();
    peerRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setVideo("none");
    setMessages([]);
    setConn({ kind: "idle" });
    if (message) showNotice(message);
  }

  function startPeer(peerId: string, initiator: boolean) {
    if (!sessionId) return;
    const ps = new PeerSession(initiator, {
      onSignal: (type: DescType, payload: string) => {
        void sendSignal(sessionId, peerId, type, payload);
      },
      onChat: (text) => addMessage(false, text),
      onControl: (ctrl) => handleControl(ctrl),
      onDraw: (msg) => remoteDrawRef.current?.(msg),
      onClear: () => remoteClearRef.current?.(),
      onRemoteStream: (stream) => setRemoteStream(stream),
      onConnectionState: (state) => {
        if (state === "failed") teardown("Connection failed.");
      },
      onChannelOpen: () => setConn({ kind: "connected", peerId }),
    });
    peerRef.current = ps;
  }

  function handleControl(ctrl: PeerControl) {
    const ps = peerRef.current;
    switch (ctrl) {
      case "video-request":
        if (videoRef.current === "none") setVideo("incoming");
        break;
      case "video-accept":
        if (videoRef.current === "requesting" && ps) {
          ps.startVideo()
            .then((s) => {
              setLocalStream(s);
              setVideo("active");
            })
            .catch(() => {
              setVideo("none");
              ps.sendControl("video-end");
              showNotice("Camera unavailable.");
            });
        }
        break;
      case "video-decline":
        if (videoRef.current === "requesting") {
          setVideo("none");
          showNotice("Video declined.");
        }
        break;
      case "video-end":
        ps?.stopVideo();
        setLocalStream(null);
        setRemoteStream(null);
        setVideo("none");
        break;
    }
  }

  function requestConnection(peerId: string) {
    if (!sessionId || connRef.current.kind !== "idle") return;
    setConn({ kind: "requesting", peerId });
    void sendSignal(sessionId, peerId, "request");
    requestTimer.current = setTimeout(() => {
      if (
        connRef.current.kind === "requesting" &&
        connRef.current.peerId === peerId
      ) {
        void sendSignal(sessionId, peerId, "end");
        teardown("No answer.");
      }
    }, REQUEST_TIMEOUT_MS);
  }

  function cancelRequest() {
    if (connRef.current.kind === "requesting" && sessionId) {
      void sendSignal(sessionId, connRef.current.peerId, "end");
    }
    teardown();
  }

  function acceptIncoming() {
    if (connRef.current.kind !== "incoming" || !sessionId) return;
    const peerId = connRef.current.peerId;
    startPeer(peerId, false);
    void sendSignal(sessionId, peerId, "accept");
    setConn({ kind: "connecting", peerId });
  }

  function declineIncoming() {
    if (connRef.current.kind !== "incoming" || !sessionId) return;
    void sendSignal(sessionId, connRef.current.peerId, "decline");
    setConn({ kind: "idle" });
  }

  function endConnection() {
    const c = connRef.current;
    if ((c.kind === "connecting" || c.kind === "connected") && sessionId)
      void sendSignal(sessionId, c.peerId, "end");
    teardown();
  }

  function startVideoRequest() {
    if (videoRef.current !== "none" || !peerRef.current) return;
    setVideo("requesting");
    peerRef.current.sendControl("video-request");
  }

  function acceptVideo() {
    peerRef.current
      ?.startVideo()
      .then((s) => {
        setLocalStream(s);
        peerRef.current?.sendControl("video-accept");
        setVideo("active");
      })
      .catch(() => {
        peerRef.current?.sendControl("video-decline");
        setVideo("none");
        showNotice("Camera unavailable.");
      });
  }

  function declineVideo() {
    peerRef.current?.sendControl("video-decline");
    setVideo("none");
  }

  function endVideo() {
    peerRef.current?.stopVideo();
    peerRef.current?.sendControl("video-end");
    setLocalStream(null);
    setRemoteStream(null);
    setVideo("none");
  }

  async function processSignal(sig: SignalMsg) {
    if (!sessionId) return;
    const ps = peerRef.current;
    switch (sig.type) {
      case "request":
        if (connRef.current.kind === "idle")
          setConn({ kind: "incoming", peerId: sig.fromId });
        else void sendSignal(sessionId, sig.fromId, "decline");
        break;
      case "accept":
        if (
          connRef.current.kind === "requesting" &&
          connRef.current.peerId === sig.fromId
        ) {
          if (requestTimer.current) clearTimeout(requestTimer.current);
          startPeer(sig.fromId, true);
          setConn({ kind: "connecting", peerId: sig.fromId });
        }
        break;
      case "decline":
        if (
          connRef.current.kind === "requesting" &&
          connRef.current.peerId === sig.fromId
        ) {
          if (requestTimer.current) clearTimeout(requestTimer.current);
          teardown("Request declined.");
        }
        break;
      case "offer":
      case "answer":
        if (ps && sig.payload)
          await ps.handleSignal(sig.type as DescType, sig.payload);
        break;
      case "ice":
        if (ps && sig.payload) await ps.handleSignal("ice", sig.payload);
        break;
      case "end":
        if (
          (connRef.current.kind === "incoming" ||
            connRef.current.kind === "connecting" ||
            connRef.current.kind === "connected") &&
          connRef.current.peerId === sig.fromId
        ) {
          if (connRef.current.kind === "incoming") setConn({ kind: "idle" });
          else teardown("Stranger disconnected.");
        }
        break;
    }
  }

  const processSignalRef = useRef(processSignal);
  useEffect(() => {
    processSignalRef.current = processSignal;
  });

  useEffect(() => {
    if (phase !== "live" || !sessionId) return;
    const sid = sessionId;
    let active = true;
    const tick = async () => {
      try {
        const data = await poll(sid);
        if (!active) return;
        setPeers(data.peers);
        for (const s of data.signals) processSignalRef.current(s);
      } catch {}
      if (active) setTimeout(tick, POLL_INTERVAL_MS);
    };
    tick();
    return () => {
      active = false;
    };
  }, [phase, sessionId]);

  useEffect(() => {
    if (!sessionId || phase !== "live") return;
    const onLeave = () => leave(sessionId);
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [sessionId, phase]);

  async function handleReady(lat: number, lng: number) {
    if (!sessionId) return;
    setMyLocation({ lat, lng });
    await join(sessionId, lat, lng).catch(console.error);
    setPhase("live");
  }

  if (phase === "gate") return <EntryGate onReady={handleReady} />;

  const inChat = conn.kind === "connecting" || conn.kind === "connected";

  return (
    <main className="fixed inset-0 overflow-hidden">
      <WorldMap
        peers={peers}
        me={myLocation}
        onPeerClick={requestConnection}
        canConnect={conn.kind === "idle"}
      />

      {/* Toast notices */}
      <AnimatePresence>
        {notice && (
          <motion.div
            className="absolute left-1/2 top-6 z-30 -translate-x-1/2 rounded-full bg-zinc-800/90 px-4 py-2 text-sm text-zinc-100 shadow-lg backdrop-blur"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            {notice}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Requesting banner */}
      <AnimatePresence>
        {conn.kind === "requesting" && (
          <motion.div
            className="absolute left-1/2 top-6 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full bg-zinc-800/90 px-4 py-2 text-sm text-zinc-100 shadow-lg backdrop-blur"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
            <span>Requesting connection…</span>
            <button
              onClick={cancelRequest}
              className="rounded-full bg-zinc-700 px-3 py-1 text-xs hover:bg-zinc-600"
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Incoming connection prompt */}
      <AnimatePresence>
        {conn.kind === "incoming" && (
          <ConnectionPrompt
            title="A stranger wants to connect"
            acceptLabel="Accept"
            declineLabel="Decline"
            onAccept={acceptIncoming}
            onDecline={declineIncoming}
          />
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {inChat && (
          <ChatPanel
            messages={messages}
            connected={conn.kind === "connected"}
            videoBusy={video !== "none"}
            onSend={(t) => {
              peerRef.current?.sendChat(t);
              addMessage(true, t);
            }}
            onStartVideo={startVideoRequest}
            onEnd={endConnection}
            onDraw={(msg) => peerRef.current?.sendDraw(msg)}
            onClear={() => peerRef.current?.sendClear()}
            remoteDrawRef={remoteDrawRef}
            remoteClearRef={remoteClearRef}
          />
        )}
      </AnimatePresence>

      {/* Video requesting banner */}
      <AnimatePresence>
        {video === "requesting" && (
          <motion.div
            className="absolute bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-full bg-zinc-800/90 px-4 py-2 text-sm text-zinc-100 shadow-lg backdrop-blur"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
          >
            Waiting for stranger…
          </motion.div>
        )}
      </AnimatePresence>

      {/* Incoming video prompt */}
      <AnimatePresence>
        {video === "incoming" && (
          <ConnectionPrompt
            title="Start video call?"
            subtitle="The stranger wants to turn on video."
            acceptLabel="Accept"
            declineLabel="Decline"
            onAccept={acceptVideo}
            onDecline={declineVideo}
          />
        )}
      </AnimatePresence>

      {/* Video panel */}
      <AnimatePresence>
        {video === "active" && (
          <VideoPanel
            localStream={localStream}
            remoteStream={remoteStream}
            onEnd={endVideo}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

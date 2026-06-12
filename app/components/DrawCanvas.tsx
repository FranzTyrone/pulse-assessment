"use client";

import { useEffect, useRef, useCallback } from "react";
import type { DrawMessage } from "@/lib/types";

const COLORS = [
  "#ffffff",
  "#60a5fa", // blue-400
  "#34d399", // emerald-400
  "#f472b6", // pink-400
  "#fb923c", // orange-400
  "#facc15", // yellow-400
  "#a78bfa", // violet-400
  "#f87171", // red-400
];

interface Props {
  color: string;
  brushSize: number;
  onColorChange: (c: string) => void;
  onBrushChange: (s: number) => void;
  onDraw: (msg: DrawMessage) => void;
  onClear: () => void;
  // Called by parent to replay a remote draw stroke
  remoteDrawRef: React.MutableRefObject<((msg: DrawMessage) => void) | null>;
  remoteClearRef: React.MutableRefObject<(() => void) | null>;
}

export default function DrawCanvas({
  color,
  brushSize,
  onColorChange,
  onBrushChange,
  onDraw,
  onClear,
  remoteDrawRef,
  remoteClearRef,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  // Expose remote draw handler to parent
  useEffect(() => {
    remoteDrawRef.current = (msg: DrawMessage) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      drawLine(ctx, msg.x0, msg.y0, msg.x1, msg.y1, msg.color, msg.width);
    };
    remoteClearRef.current = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [remoteDrawRef, remoteClearRef]);

  function drawLine(
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    strokeColor: string,
    strokeWidth: number,
  ) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    last.current = getPos(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !last.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const curr = getPos(e);
    drawLine(
      ctx,
      last.current.x,
      last.current.y,
      curr.x,
      curr.y,
      color,
      brushSize,
    );

    onDraw({
      t: "draw",
      x0: last.current.x,
      y0: last.current.y,
      x1: curr.x,
      y1: curr.y,
      color,
      width: brushSize,
    });

    last.current = curr;
  }

  function onPointerUp() {
    drawing.current = false;
    last.current = null;
  }

  function handleClear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onClear();
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-white/8 px-3 py-2 flex-wrap">
        {/* Color swatches */}
        <div className="flex items-center gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onColorChange(c)}
              className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                backgroundColor: c,
                borderColor: color === c ? "white" : "transparent",
              }}
            />
          ))}
        </div>

        {/* Brush size */}
        <div className="flex items-center gap-1.5 ml-auto">
          {[2, 4, 8].map((s) => (
            <button
              key={s}
              onClick={() => onBrushChange(s)}
              className={`flex items-center justify-center rounded-full transition ${
                brushSize === s
                  ? "bg-white/20 text-white"
                  : "text-zinc-500 hover:text-white"
              }`}
              style={{ width: 24, height: 24 }}
            >
              <span
                className="rounded-full bg-current"
                style={{ width: s + 4, height: s + 4 }}
              />
            </button>
          ))}
        </div>

        {/* Clear */}
        <button
          onClick={handleClear}
          className="ml-1 rounded px-2 py-0.5 text-xs text-zinc-500 hover:text-red-400 transition border border-white/8 hover:border-red-400/30"
        >
          Clear
        </button>
      </div>

      {/* Canvas */}
      <div className="relative flex-1">
        <canvas
          ref={canvasRef}
          width={384}
          height={480}
          className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
        <p className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-xs text-zinc-700">
          Draw together — disappears when you disconnect
        </p>
      </div>
    </div>
  );
}

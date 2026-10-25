import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { signalLimiter, allowRequest } from "@/lib/ratelimit";
import type { SignalType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPES: SignalType[] = [
  "request",
  "accept",
  "decline",
  "offer",
  "answer",
  "ice",
  "end",
];

const MAX_PAYLOAD = 64 * 1024;

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  if (!(await allowRequest(signalLimiter, request))) {
    return Response.json({ error: "too many requests" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const { fromId, toId, type, payload, token } = (body ?? {}) as Record<
    string,
    unknown
  >;

  if (
    typeof fromId !== "string" ||
    !UUID_V4.test(fromId) ||
    typeof toId !== "string" ||
    !UUID_V4.test(toId)
  ) {
    return Response.json({ error: "invalid ids" }, { status: 400 });
  }
  if (typeof token !== "string") {
    return Response.json({ error: "missing token" }, { status: 401 });
  }

  const valid = await verifyToken(fromId, token);
  if (!valid) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const signalType = type as SignalType;

  if (!VALID_TYPES.includes(signalType)) {
    return Response.json({ error: "invalid type" }, { status: 400 });
  }

  const payloadStr = typeof payload === "string" ? payload : null;

  if (payloadStr && payloadStr.length > MAX_PAYLOAD) {
    return Response.json({ error: "payload too large" }, { status: 413 });
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[API SIGNAL] Received type: ${type} from: ${fromId} to: ${toId}`,
    );
  }

  if (signalType === "request") {
    const target = await prisma.presence.findUnique({
      where: { id: toId },
      select: { busy: true },
    });

    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[API SIGNAL] Target ${toId} exists: ${!!target}, isBusy: ${target?.busy}`,
      );
    }

    if (!target || target.busy) {
      if (process.env.NODE_ENV !== "production") {
        console.log(`[API SIGNAL] Request auto-declined for ${toId}`);
      }
      await sendDecline(toId, fromId);
      return Response.json({ ok: true, autoDeclined: true });
    }
  }

  try {
    const savedSignal = await prisma.signal.create({
      data: { fromId, toId, type: signalType, payload: payloadStr },
    });
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[API SIGNAL] Successfully saved to DB, ID: ${savedSignal.id}`,
      );
    }
  } catch (err) {
    console.error("[API SIGNAL] Database Error:", err);
    return Response.json({ error: "db write failed" }, { status: 500 });
  }

  return Response.json({ ok: true });
}

async function sendDecline(targetId: string, initiatorId: string) {
  await prisma.signal.create({
    data: {
      fromId: targetId,
      toId: initiatorId,
      type: "decline",
      payload: null,
    },
  });
}

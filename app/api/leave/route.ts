import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { leaveLimiter, allowRequest } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/leave — body { id, token }. Removes the presence row and any
// pending signals to/from this user. Called via navigator.sendBeacon on tab
// close, so the body may arrive as text — parse defensively.
export async function POST(request: NextRequest) {
  if (!(await allowRequest(leaveLimiter, request))) {
    return Response.json({ error: "too many requests" }, { status: 429 });
  }

  let id: string | undefined;
  let token: string | undefined;
  try {
    const text = await request.text();
    const parsed = text ? JSON.parse(text) : {};
    id = parsed?.id as string | undefined;
    token = parsed?.token as string | undefined;
  } catch {
    id = undefined;
    token = undefined;
  }

  if (typeof id !== "string" || !id || typeof token !== "string" || !token) {
    return Response.json({ error: "invalid id or token" }, { status: 400 });
  }

  const valid = await verifyToken(id, token);
  if (!valid) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // Independent cleanup deletes — no atomicity needed (and interactive
  // transactions are unreliable over a PgBouncer pooler).
  await prisma.signal.deleteMany({
    where: { OR: [{ toId: id }, { fromId: id }] },
  });
  await prisma.presence.deleteMany({ where: { id } });

  return Response.json({ ok: true });
}

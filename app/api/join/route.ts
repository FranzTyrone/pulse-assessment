import { randomBytes } from "crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyPrivacyOffset, isValidLatLng } from "@/lib/geo";
import { joinLimiter, getIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// POST /api/join — body { id, lat, lng } (raw coords).
// Applies a 1–3 km privacy offset and upserts the presence row. Raw
// coordinates are never stored. Returns a secret token the client must
// include on all subsequent requests.
export async function POST(request: NextRequest) {
  const { success } = await joinLimiter.limit(getIp(request));
  if (!success) {
    return Response.json({ error: "too many requests" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const { id, lat, lng } = (body ?? {}) as Record<string, unknown>;

  if (typeof id !== "string" || !UUID_V4.test(id)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  if (!isValidLatLng(lat, lng)) {
    return Response.json({ error: "invalid coordinates" }, { status: 400 });
  }

  const offset = applyPrivacyOffset(lat as number, lng as number);
  const token = randomBytes(32).toString("hex");

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[JOIN DEBUG] Attempting to upsert/create Presence for ID: ${id}`,
    );
  }

  await prisma.presence.upsert({
    where: { id },
    create: {
      id,
      token,
      lat: offset.lat,
      lng: offset.lng,
      busy: false,
      lastSeen: new Date(),
    },
    update: {
      token,
      lat: offset.lat,
      lng: offset.lng,
      lastSeen: new Date(),
    },
  });

  return Response.json({ ok: true, token });
}

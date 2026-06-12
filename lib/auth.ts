import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

export async function verifyToken(id: string, token: string): Promise<boolean> {
  if (!id || !token) return false;
  const presence = await prisma.presence.findUnique({
    where: { id },
    select: { token: true },
  });
  if (!presence) return false;
  try {
    return timingSafeEqual(Buffer.from(presence.token), Buffer.from(token));
  } catch {
    // timingSafeEqual throws if buffers differ in length
    return false;
  }
}

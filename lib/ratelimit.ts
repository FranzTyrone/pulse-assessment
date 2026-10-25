import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// /api/join — 10 joins per IP per minute (prevents session spam)
export const joinLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "rl:join",
});

// /api/poll — 120 polls per IP per minute (allows ~2/sec polling cadence)
export const pollLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(120, "1 m"),
  prefix: "rl:poll",
});

// /api/signal — 60 signals per IP per minute (generous for WebRTC handshake)
export const signalLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  prefix: "rl:signal",
});

// /api/leave — 20 leaves per IP per minute
export const leaveLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "1 m"),
  prefix: "rl:leave",
});

let warnedUnavailable = false;

/**
 * Returns true if the request may proceed. Fails open when Redis is
 * unreachable (e.g. the Upstash database was deleted or env vars are wrong)
 * so a rate-limiter outage never takes the whole app down.
 */
export async function allowRequest(
  limiter: Ratelimit,
  request: Request,
): Promise<boolean> {
  try {
    const { success } = await limiter.limit(getIp(request));
    return success;
  } catch (err) {
    if (!warnedUnavailable) {
      warnedUnavailable = true;
      console.error("[ratelimit] Redis unavailable, failing open:", err);
    }
    return true;
  }
}

/** Extract the real client IP from Next.js request headers. */
export function getIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "anonymous"
  );
}

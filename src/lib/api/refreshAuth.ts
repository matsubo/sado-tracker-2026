import { timingSafeEqual } from "node:crypto";

export type RefreshAuth = "ok" | "denied" | "disabled";

const BEARER = /^Bearer\s+(.+)$/i;

/**
 * Whether a manual refresh may run. A configured token must arrive as a
 * bearer header and is compared in constant time. With no token the endpoint
 * is open on a private host, where anyone who can reach it can already do
 * worse, and switched off in production, where it must never be open.
 */
export function authorizeRefresh(
  env: Partial<NodeJS.ProcessEnv>,
  authorization: string | null,
): RefreshAuth {
  const expected = env.REFRESH_TOKEN;
  if (!expected) return env.NODE_ENV === "production" ? "disabled" : "ok";

  const given = authorization === null ? null : BEARER.exec(authorization)?.[1]?.trim();
  if (!given) return "denied";

  const left = Buffer.from(given);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return "denied";
  return timingSafeEqual(left, right) ? "ok" : "denied";
}

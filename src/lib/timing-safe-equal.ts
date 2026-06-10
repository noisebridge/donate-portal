import crypto from "node:crypto";

/**
 * Compare two strings in constant time. Hashing both sides gives
 * equal-length buffers for timingSafeEqual regardless of input lengths,
 * so neither length nor content leaks through timing.
 */
export function timingSafeStringEqual(a: string, b: string) {
  const aDigest = crypto.createHash("sha256").update(a).digest();
  const bDigest = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(aDigest, bDigest);
}

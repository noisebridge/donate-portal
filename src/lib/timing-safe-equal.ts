import crypto from "node:crypto";

/**
 * Compare two strings without leaking their contents through timing.
 * Hashing both sides gives timingSafeEqual equal-length buffers whatever
 * the inputs were, so content is safe; hashing time still grows with input
 * length, so length is not hidden.
 */
export function timingSafeStringEqual(a: string, b: string) {
  const aDigest = crypto.createHash("sha256").update(a).digest();
  const bDigest = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(aDigest, bDigest);
}

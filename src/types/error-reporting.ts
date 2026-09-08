import { z } from "zod";

/**
 * Payload limits, as literal types so client code can pin its own truncation
 * constants to them. See `src/assets/js/util/error-reporting.mjs`.
 */
export const LIMITS = {
  tag: 256,
  type: 256,
  value: 2048,
  frameString: 1024,
  contextString: 1024,
  frames: 100,
} as const;
export type Limits = typeof LIMITS;

export const sentryFrameSchema = z.object({
  filename: z.string().max(LIMITS.frameString),
  function: z.string().max(LIMITS.frameString),
  lineno: z.number().int().nullable(),
  colno: z.number().int().nullable(),
});
export type SentryFrame = z.infer<typeof sentryFrameSchema>;

export const sentryExceptionSchema = z.object({
  type: z.string().max(LIMITS.type),
  value: z.string().max(LIMITS.value),
  stacktrace: z.object({
    frames: z.array(sentryFrameSchema).max(LIMITS.frames),
  }),
});
export type SentryException = z.infer<typeof sentryExceptionSchema>;

export const sentryEventSchema = z.object({
  timestamp: z.string().refine((s) => !Number.isNaN(Date.parse(s))),
  platform: z.enum(["javascript", "node"]),
  level: z.enum(["fatal", "error", "warning", "info", "debug"]),
  exception: z.object({
    values: z.array(sentryExceptionSchema).min(1).max(10),
  }),
  tags: z.record(z.string().max(64), z.string().max(LIMITS.tag)).optional(),
  contexts: z
    .record(
      z.string().max(64),
      z.record(
        z.string().max(64),
        z.union([z.string().max(LIMITS.contextString), z.number()]),
      ),
    )
    .optional(),
});
export type SentryEvent = z.infer<typeof sentryEventSchema>;

export const cspReportSchema = z.object({
  "csp-report": z.object({
    "document-uri": z.string().max(2048),
    referrer: z.string().max(2048).optional(),
    "violated-directive": z.string().max(256),
    "effective-directive": z.string().max(256).optional(),
    "original-policy": z.string().max(4096).optional(),
    "blocked-uri": z.string().max(2048).optional(),
    "status-code": z.number().int().optional(),
    "source-file": z.string().max(2048).optional(),
    "line-number": z.number().int().optional(),
    "column-number": z.number().int().optional(),
  }),
});
export type CspReport = z.infer<typeof cspReportSchema>;

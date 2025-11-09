import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

export const trackAccessSchema = z.object({
  userId: z.string().uuid().optional(),
  fingerprint: z.string().min(1).max(500),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().max(1000).optional(),
  timestamp: z.string().datetime().optional(),
  pageUrl: z.string().url().max(2000).optional(),
});

export type TrackAccessInput = z.infer<typeof trackAccessSchema>;

export function validateTrackAccessInput(body: unknown): TrackAccessInput {
  return trackAccessSchema.parse(body);
}

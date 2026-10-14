import { Throttle } from '@nestjs/throttler';
import type { ThrottlerOptions } from '@nestjs/throttler';

/**
 * Rate limits are counted per client IP *and* per route.
 *
 * - burst:     absorbs a page firing several requests at once
 * - sustained: caps steady traffic per minute
 *
 * The old global limit (3 requests/second) rejected 7 of 10 requests from a
 * single dashboard load, and behind Render's proxy every visitor would have
 * shared one bucket. main.ts now sets `trust proxy` so the real client IP is
 * used.
 */
export const THROTTLERS: ThrottlerOptions[] = [
  { name: 'burst', ttl: 1000, limit: 20 },
  { name: 'sustained', ttl: 60_000, limit: 300 },
];

/**
 * Strict limit for sensitive endpoints (login, codes, password reset…):
 * at most `perMinute` calls per IP per minute on that route.
 */
export const LimitPerMinute = (perMinute: number) =>
  Throttle({
    burst: { ttl: 1000, limit: Math.min(perMinute, 20) },
    sustained: { ttl: 60_000, limit: perMinute },
  });

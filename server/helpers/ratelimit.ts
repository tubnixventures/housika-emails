/**
 * Rate Limiting & Outbound Throttle Engine
 * 
 * Protects domain reputation (housika.co.ke, housika.com, housika.app)
 * by throttling outbound email volume per account based on hierarchy level.
 * 
 * Policy:
 * - Level 100 (CEO): 1000 emails / hour
 * - Level 90-99 (Admin): 500 emails / hour
 * - Level 80-89 (Manager): 250 emails / hour
 * - Level 70-79 (Customer Care): 100 emails / hour
 * - Anonymous / External: 20 emails / hour
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const outboundLimits = new Map<string, RateLimitRecord>();

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

export function checkOutboundRateLimit(identifier: string, level?: number): RateLimitResult {
  const now = Date.now();
  const windowMs = 3600 * 1000; // 1-hour window

  // Determine limit based on level
  let limit = 20;
  if (level !== undefined) {
    if (level >= 100) limit = 5000; // Level 100 (Corporate Broadcast / System)
    else if (level >= 90) limit = 1000; // CEO (Level 90)
    else if (level >= 80) limit = 250; // Manager (Level 80-89)
    else if (level >= 70) limit = 100; // Customer Care (Level 70-79)
  }

  const record = outboundLimits.get(identifier);

  if (!record || now > record.resetAt) {
    outboundLimits.set(identifier, {
      count: 1,
      resetAt: now + windowMs
    });
    return {
      allowed: true,
      limit,
      remaining: limit - 1,
      resetSeconds: Math.ceil(windowMs / 1000)
    };
  }

  if (record.count >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetSeconds: Math.ceil((record.resetAt - now) / 1000)
    };
  }

  record.count += 1;
  return {
    allowed: true,
    limit,
    remaining: limit - record.count,
    resetSeconds: Math.ceil((record.resetAt - now) / 1000)
  };
}

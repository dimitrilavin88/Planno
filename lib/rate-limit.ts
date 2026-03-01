/**
 * Server-side rate limiting using Supabase check_rate_limit RPC.
 * Use in API route handlers. Bucket key is built from prefix + identifier (e.g. IP).
 * ai-rules: rate limit booking and auth endpoints.
 */

import { NextRequest } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

const DEFAULT_MAX = 10
const DEFAULT_WINDOW_SEC = 60

/**
 * Returns the client IP from request headers (Vercel/proxy-friendly).
 * Avoid logging this in production if you need to comply with data retention rules.
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? 'unknown'
  }
  const real = request.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}

/** Params for the check_rate_limit RPC (custom function; not in generated DB types). */
type CheckRateLimitParams = {
  p_bucket_key: string
  p_max_count: number
  p_window_seconds: number
}

/**
 * Checks rate limit for the given bucket key. Returns true if under limit, false if over.
 * Uses Supabase service role to call check_rate_limit (only server can call with arbitrary keys).
 */
export async function checkApiRateLimit(
  bucketKey: string,
  maxCount: number = DEFAULT_MAX,
  windowSeconds: number = DEFAULT_WINDOW_SEC
): Promise<boolean> {
  const supabase = getAdminClient()
  const params: CheckRateLimitParams = {
    p_bucket_key: bucketKey,
    p_max_count: maxCount,
    p_window_seconds: windowSeconds,
  }
  // Call on supabase so 'this' is preserved (extracting .rpc breaks the client binding)
  const { data, error } = await (supabase as { rpc: (name: string, args: CheckRateLimitParams) => Promise<{ data: boolean | null; error: { message: string } | null }> }).rpc(
    'check_rate_limit',
    params
  )
  if (error) {
    console.error('[rate-limit] check_rate_limit RPC error:', error.message)
    return true
  }
  return data === true
}

/**
 * Convenience: rate limit by IP for an API route.
 * Returns null if allowed, or a NextResponse (429) if rate limited.
 */
export async function requireApiRateLimit(
  request: NextRequest,
  prefix: string,
  maxCount: number = DEFAULT_MAX,
  windowSeconds: number = DEFAULT_WINDOW_SEC
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const ip = getClientIp(request)
  const bucketKey = `${prefix}:${ip}`
  const allowed = await checkApiRateLimit(bucketKey, maxCount, windowSeconds)
  if (allowed) return { ok: true }
  return {
    ok: false,
    response: new Response(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    ),
  }
}

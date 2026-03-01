import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/utils'
import { requireApiRateLimit } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/meetings/group-availability
 * Returns available time slots for a group event type (e.g. for reschedule UI).
 * Body: { groupEventTypeId, excludeMeetingId?, startDate, endDate, timezone }
 * When excludeMeetingId is set (reschedule), that meeting is excluded from conflict check.
 */
export async function POST(request: NextRequest) {
  const rateLimit = await requireApiRateLimit(request, 'api:group-availability', 30, 60)
  if (!rateLimit.ok) return rateLimit.response

  await requireAuth()
  const supabase = await createClient()

  try {
    const body = await request.json()
    const groupEventTypeId = typeof body?.groupEventTypeId === 'string' ? body.groupEventTypeId : ''
    const excludeMeetingId = typeof body?.excludeMeetingId === 'string' ? body.excludeMeetingId : null
    const startDate = typeof body?.startDate === 'string' ? body.startDate : ''
    const endDate = typeof body?.endDate === 'string' ? body.endDate : ''
    const timezone = typeof body?.timezone === 'string' ? body.timezone : 'UTC'

    if (!groupEventTypeId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'groupEventTypeId, startDate, and endDate are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase.rpc('calculate_group_availability', {
      p_group_event_type_id: groupEventTypeId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_timezone: timezone,
      p_exclude_meeting_id: excludeMeetingId,
    })

    if (error) {
      console.error('calculate_group_availability error:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to load availability' },
        { status: 500 }
      )
    }

    const slots = Array.isArray(data) ? data : []
    console.log('[group-availability]', { groupEventTypeId, startDate, endDate, excludeMeetingId: excludeMeetingId ?? null, slotCount: slots.length })
    return NextResponse.json({ slots })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

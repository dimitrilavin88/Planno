import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/utils'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  await requireAuth()
  const supabase = await createClient()

  try {
    const body = await request.json()
    const recurringScheduleId =
      typeof body?.recurringScheduleId === 'string' ? body.recurringScheduleId : ''

    if (!recurringScheduleId) {
      return NextResponse.json({ error: 'Recurring schedule ID is required' }, { status: 400 })
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(recurringScheduleId)) {
      return NextResponse.json({ error: 'Invalid recurring schedule ID format' }, { status: 400 })
    }

    // Authorization check via RLS: if user can read this schedule, they can trigger cleanup
    const { data: schedule, error: scheduleError } = await supabase
      .from('recurring_meeting_schedules')
      .select('id')
      .eq('id', recurringScheduleId)
      .single()

    if (scheduleError || !schedule) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 })
    }

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/delete-calendar-event`
    console.log('Calling Edge Function:', edgeFunctionUrl)
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({ recurring_schedule_id: recurringScheduleId }),
    })

    const responseText = await response.text()
    let payload: unknown = {}
    try {
      payload = responseText ? JSON.parse(responseText) : {}
    } catch {
      payload = { success: false, error: responseText || 'Invalid edge response' }
    }

    if (!response.ok) {
      return NextResponse.json(payload, { status: 500 })
    }

    return NextResponse.json(payload)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


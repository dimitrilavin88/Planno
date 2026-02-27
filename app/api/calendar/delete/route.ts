import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/utils'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  await requireAuth()
  const supabase = await createServerClient()

  try {
    const body = await request.json()
    const meetingId = typeof body?.meetingId === 'string' ? body.meetingId : ''

    if (!meetingId) {
      return NextResponse.json(
        { error: 'Meeting ID is required' },
        { status: 400 }
      )
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(meetingId)) {
      return NextResponse.json(
        { error: 'Invalid meeting ID format' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration missing' },
        { status: 500 }
      )
    }

    // Current user (caller-scoped)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Load meeting with service role so we see it even after status = 'cancelled'
    const admin = createClient(supabaseUrl, serviceRoleKey)
    const { data: meeting, error: meetingError } = await admin
      .from('meetings')
      .select('id, host_user_id')
      .eq('id', meetingId)
      .single()

    if (meetingError || !meeting) {
      return NextResponse.json({ success: true, message: 'Meeting not found for calendar cleanup' })
    }

    // Authorize: caller must be host or a participant
    const isHost = meeting.host_user_id === user.id
    if (!isHost) {
      const { data: participant } = await admin
        .from('meeting_participants')
        .select('user_id')
        .eq('meeting_id', meetingId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!participant) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
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
      body: JSON.stringify({ meeting_id: meetingId }),
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
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}


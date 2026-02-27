import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/utils'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  await requireAuth()
  const supabase = await createServerClient()

  try {
    const { meetingId, newStartTime, newEndTime } = await request.json()

    if (!meetingId || !newStartTime || !newEndTime) {
      return NextResponse.json(
        { error: 'Meeting ID, new start time, and new end time are required' },
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

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createClient(supabaseUrl, serviceRoleKey)

    // Load meeting (anyone with access can trigger calendar update; we use host's calendar)
    const { data: meeting, error: meetingError } = await admin
      .from('meetings')
      .select('id, host_user_id, timezone, calendar_event_id, calendar_provider')
      .eq('id', meetingId)
      .single()

    if (meetingError || !meeting) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      )
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

    // Get host's connected calendars (use service role so we can use host's credentials)
    const { data: calendars } = await admin
      .from('calendars')
      .select('*')
      .eq('user_id', meeting.host_user_id)
      .eq('provider', meeting.calendar_provider || 'google')
      .eq('is_active', true)

    if (!calendars || calendars.length === 0) {
      return NextResponse.json({ success: true, message: 'No calendar connected' })
    }

    const calendar = calendars[0]

    // Refresh token if needed
    let accessToken = calendar.access_token
    const tokenExpiresAt = calendar.token_expires_at ? new Date(calendar.token_expires_at) : null

    if (tokenExpiresAt && tokenExpiresAt <= new Date()) {
      // Refresh token
      const clientId = process.env.GOOGLE_CLIENT_ID
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET

      if (!clientId || !clientSecret || !calendar.refresh_token) {
        return NextResponse.json(
          { error: 'Missing OAuth credentials' },
          { status: 500 }
        )
      }

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: calendar.refresh_token,
          grant_type: 'refresh_token',
        }),
      })

      if (!tokenResponse.ok) {
        return NextResponse.json(
          { error: 'Failed to refresh token' },
          { status: 500 }
        )
      }

      const tokens = await tokenResponse.json()
      accessToken = tokens.access_token

      // Update host's calendar token in database (use admin - caller may be participant)
      await admin
        .from('calendars')
        .update({
          access_token: tokens.access_token,
          token_expires_at: tokens.expires_in
            ? new Date(Date.now() + tokens.expires_in * 1000)
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', calendar.id)
    }

    // Update Google Calendar event
    if (meeting.calendar_event_id && calendar.provider === 'google') {
      const eventData = {
        start: {
          dateTime: newStartTime,
          timeZone: meeting.timezone || 'UTC',
        },
        end: {
          dateTime: newEndTime,
          timeZone: meeting.timezone || 'UTC',
        },
      }

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendar.calendar_id}/events/${meeting.calendar_event_id}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventData),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to update calendar event')
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    )
  }
}


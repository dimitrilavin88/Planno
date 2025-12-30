import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/utils'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const user = await requireAuth()
  const supabase = await createClient()

  try {
    const { meetingId } = await request.json()

    if (!meetingId) {
      return NextResponse.json(
        { error: 'Meeting ID is required' },
        { status: 400 }
      )
    }

    // Get meeting details
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('calendar_event_id, calendar_provider, host_user_id')
      .eq('id', meetingId)
      .eq('host_user_id', user.id)
      .single()

    if (meetingError || !meeting) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      )
    }

    // If no calendar event ID, nothing to delete
    if (!meeting.calendar_event_id) {
      return NextResponse.json({ success: true, message: 'No calendar event to delete' })
    }

    // Get host's connected calendars
    const { data: calendars } = await supabase
      .from('calendars')
      .select('*')
      .eq('user_id', user.id)
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

      await supabase
        .from('calendars')
        .update({
          access_token: tokens.access_token,
          token_expires_at: tokens.expires_in
            ? new Date(Date.now() + tokens.expires_in * 1000)
            : null,
        })
        .eq('id', calendar.id)
    }

    // Delete Google Calendar event
    if (calendar.provider === 'google') {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendar.calendar_id}/events/${meeting.calendar_event_id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      // 404 means event already deleted, which is fine
      if (!response.ok && response.status !== 404) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || 'Failed to delete calendar event')
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


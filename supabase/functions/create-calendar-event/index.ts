// Supabase Edge Function: Create Calendar Event
// This function creates a calendar event in Google Calendar or Outlook
// Triggered after a meeting is booked

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { meeting_id } = await req.json()

    if (!meeting_id) {
      throw new Error('meeting_id is required')
    }

    // Fetch meeting details
    const { data: meeting, error: meetingError } = await supabaseClient
      .from('meetings')
      .select(`
        *,
        event_types:event_type_id (
          name,
          description,
          location_type,
          location
        ),
        participants:meeting_participants (
          name,
          email,
          is_host
        )
      `)
      .eq('id', meeting_id)
      .single()

    if (meetingError || !meeting) {
      throw new Error('Meeting not found')
    }

    const eventType = Array.isArray(meeting.event_types)
      ? meeting.event_types[0]
      : meeting.event_types

    // Get host's connected calendars
    const { data: calendars } = await supabaseClient
      .from('calendars')
      .select('*')
      .eq('user_id', meeting.host_user_id)
      .eq('is_active', true)

    // Helper function to refresh Google access token
    const refreshGoogleToken = async (calendar: any): Promise<string> => {
      const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
      const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

      if (!clientId || !clientSecret || !calendar.refresh_token) {
        throw new Error('Missing Google OAuth credentials or refresh token')
      }

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: calendar.refresh_token,
          grant_type: 'refresh_token',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to refresh Google token')
      }

      const tokens = await response.json()

      // Update token in database
      const expiresAt = tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null

      await supabaseClient
        .from('calendars')
        .update({
          access_token: tokens.access_token,
          token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', calendar.id)

      return tokens.access_token
    }

    // Helper function to create Google Calendar event
    const createGoogleCalendarEvent = async (
      calendar: any,
      accessToken: string,
      meeting: any,
      eventType: any
    ) => {
      // Get participant emails
      const participants = Array.isArray(meeting.participants)
        ? meeting.participants
        : [meeting.participants]

      const attendees = participants
        .filter((p: any) => p.email)
        .map((p: any) => ({ email: p.email }))

      // Format event data
      const eventData = {
        summary: eventType?.name || meeting.title,
        description: eventType?.description || meeting.description || '',
        start: {
          dateTime: meeting.start_time,
          timeZone: meeting.timezone || 'UTC',
        },
        end: {
          dateTime: meeting.end_time,
          timeZone: meeting.timezone || 'UTC',
        },
        location: eventType?.location || meeting.location || '',
        attendees: attendees,
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 0 }, // Immediate notification when event is created
            { method: 'email', minutes: 24 * 60 }, // 24 hours before
            { method: 'popup', minutes: 15 }, // 15 minutes before
          ],
        },
      }

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendar.calendar_id}/events`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventData),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to create Google Calendar event')
      }

      const event = await response.json()
      return event
    }

    // Create calendar events for each connected calendar
    const results = []
    for (const calendar of calendars || []) {
      try {
        if (calendar.provider === 'google') {
          // Check if token needs refresh
          let accessToken = calendar.access_token
          const tokenExpiresAt = calendar.token_expires_at
            ? new Date(calendar.token_expires_at)
            : null

          if (tokenExpiresAt && tokenExpiresAt <= new Date()) {
            accessToken = await refreshGoogleToken(calendar)
          }

          // Create Google Calendar event
          const googleEvent = await createGoogleCalendarEvent(
            calendar,
            accessToken,
            meeting,
            eventType
          )

          // Update meeting with calendar event ID
          await supabaseClient
            .from('meetings')
            .update({
              calendar_event_id: googleEvent.id,
              calendar_provider: 'google',
            })
            .eq('id', meeting_id)

          results.push({
            calendar_id: calendar.id,
            provider: 'google',
            status: 'success',
            event_id: googleEvent.id,
          })
        } else if (calendar.provider === 'outlook') {
          // TODO: Implement Outlook Calendar API integration
          results.push({ calendar_id: calendar.id, provider: 'outlook', status: 'pending' })
        }
      } catch (error: any) {
        console.error(`Failed to create event in ${calendar.provider}:`, error)
        results.push({
          calendar_id: calendar.id,
          provider: calendar.provider,
          status: 'error',
          error: error.message,
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})


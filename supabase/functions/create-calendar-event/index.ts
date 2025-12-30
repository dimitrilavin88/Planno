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

    // Create calendar events for each connected calendar
    const results = []
    for (const calendar of calendars || []) {
      try {
        if (calendar.provider === 'google') {
          // TODO: Implement Google Calendar API integration
          // const googleEvent = await createGoogleCalendarEvent(calendar, meeting, eventType)
          results.push({ calendar_id: calendar.id, provider: 'google', status: 'pending' })
        } else if (calendar.provider === 'outlook') {
          // TODO: Implement Outlook Calendar API integration
          // const outlookEvent = await createOutlookCalendarEvent(calendar, meeting, eventType)
          results.push({ calendar_id: calendar.id, provider: 'outlook', status: 'pending' })
        }
      } catch (error) {
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


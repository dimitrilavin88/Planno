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
    // @ts-ignore - Deno is available at runtime in Supabase Edge Functions
    const supabaseClient = createClient(
      // @ts-ignore - Deno is available at runtime in Supabase Edge Functions
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore - Deno is available at runtime in Supabase Edge Functions
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Handle both POST (from webhook) and GET (for testing)
    let meeting_id: string | null = null
    if (req.method === 'POST') {
      try {
        const body = await req.json()
        meeting_id = body.meeting_id
      } catch {
        const url = new URL(req.url)
        meeting_id = url.searchParams.get('meeting_id')
      }
    } else if (req.method === 'GET') {
      const url = new URL(req.url)
      meeting_id = url.searchParams.get('meeting_id')
    }

    if (!meeting_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'meeting_id is required',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
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
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Meeting not found',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      )
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
    const results: Array<{
      calendar_id: string
      provider: string
      status: string
      error?: string
    }> = []
    
    if (!calendars || calendars.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active calendars found for host',
          results: [],
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    for (const calendar of calendars) {
      try {
        if (calendar.provider === 'google') {
          // TODO: Implement Google Calendar API integration
          // This requires OAuth setup and Google Calendar API
          // const googleEvent = await createGoogleCalendarEvent(calendar, meeting, eventType)
          results.push({
            calendar_id: calendar.id,
            provider: 'google',
            status: 'not_implemented',
            error: 'Google Calendar integration not yet implemented',
          })
        } else if (calendar.provider === 'outlook') {
          // TODO: Implement Outlook Calendar API integration
          // This requires OAuth setup and Microsoft Graph API
          // const outlookEvent = await createOutlookCalendarEvent(calendar, meeting, eventType)
          results.push({
            calendar_id: calendar.id,
            provider: 'outlook',
            status: 'not_implemented',
            error: 'Outlook Calendar integration not yet implemented',
          })
        }
      } catch (error: any) {
        console.error(`Failed to create event in ${calendar.provider}:`, error)
        results.push({
          calendar_id: calendar.id,
          provider: calendar.provider,
          status: 'error',
          error: error?.message || 'Unknown error',
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Calendar event creation attempted (integration pending)',
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


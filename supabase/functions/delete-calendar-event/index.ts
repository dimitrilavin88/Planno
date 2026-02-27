// Supabase Edge Function: Delete Calendar Event(s)
// Supports deleting:
// - a single meeting event via meeting_id
// - recurring series events via recurring_schedule_id (future cancelled meetings)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  meeting_id?: string
  recurring_schedule_id?: string
}

interface MeetingRow {
  id: string
  host_user_id: string
  calendar_event_id: string | null
  calendar_provider: string | null
  status: string
  start_time: string
}

interface CalendarRow {
  id: string
  user_id: string
  provider: string
  calendar_id: string
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
}

interface GoogleTokenResponse {
  access_token: string
  expires_in?: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase service credentials')
    }

    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const body = (await req.json()) as RequestBody
    const meetingId = body.meeting_id?.trim() || ''
    const recurringScheduleId = body.recurring_schedule_id?.trim() || ''

    if (!meetingId && !recurringScheduleId) {
      throw new Error('meeting_id or recurring_schedule_id is required')
    }

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

    const calendarCache = new Map<string, CalendarRow[]>()

    const refreshGoogleToken = async (calendar: CalendarRow): Promise<string> => {
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
        const errorText = await response.text()
        throw new Error(`Failed to refresh Google token: ${errorText}`)
      }

      const tokens = (await response.json()) as GoogleTokenResponse
      await client
        .from('calendars')
        .update({
          access_token: tokens.access_token,
          token_expires_at: tokens.expires_in
            ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', calendar.id)

      return tokens.access_token
    }

    const getHostCalendars = async (hostUserId: string, provider: string): Promise<CalendarRow[]> => {
      const cacheKey = `${hostUserId}:${provider}`
      const cached = calendarCache.get(cacheKey)
      if (cached) return cached

      const { data } = await client
        .from('calendars')
        .select('id, user_id, provider, calendar_id, access_token, refresh_token, token_expires_at')
        .eq('user_id', hostUserId)
        .eq('provider', provider)
        .eq('is_active', true)

      const calendars = (data || []) as CalendarRow[]
      calendarCache.set(cacheKey, calendars)
      return calendars
    }

    const deleteGoogleEventForMeeting = async (meeting: MeetingRow): Promise<'deleted' | 'skipped' | 'failed'> => {
      if (!meeting.calendar_event_id) return 'skipped'
      const provider = meeting.calendar_provider || 'google'
      if (provider !== 'google') return 'skipped'

      const calendars = await getHostCalendars(meeting.host_user_id, provider)
      if (calendars.length === 0) return 'skipped'

      let lastError: string | null = null
      for (const calendar of calendars) {
        try {
          let accessToken = calendar.access_token
          const tokenExpiresAt = calendar.token_expires_at ? new Date(calendar.token_expires_at) : null
          if (!accessToken || (tokenExpiresAt && tokenExpiresAt <= new Date())) {
            accessToken = await refreshGoogleToken(calendar)
          }

          const response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${calendar.calendar_id}/events/${meeting.calendar_event_id}`,
            {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          )

          // 404 means event already deleted (idempotent success)
          if (response.ok || response.status === 404) {
            return 'deleted'
          }

          const errorData = await response.json().catch(() => ({}))
          lastError = errorData?.error?.message || `Delete failed for calendar ${calendar.calendar_id}`
        } catch (err: unknown) {
          lastError = err instanceof Error ? err.message : 'Unknown delete error'
        }
      }

      console.error('Delete failed for meeting:', { meetingId: meeting.id, lastError })
      return 'failed'
    }

    let meetingsToProcess: MeetingRow[] = []

    if (meetingId) {
      const { data: meeting, error: meetingError } = await client
        .from('meetings')
        .select('id, host_user_id, calendar_event_id, calendar_provider, status, start_time')
        .eq('id', meetingId)
        .single()

      if (meetingError || !meeting) {
        return new Response(
          JSON.stringify({ success: true, deleted: 0, skipped: 1, failed: 0, message: 'Meeting not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      meetingsToProcess = [meeting as MeetingRow]
    } else {
      const nowIso = new Date().toISOString()
      const { data: seriesMeetings } = await client
        .from('meetings')
        .select('id, host_user_id, calendar_event_id, calendar_provider, status, start_time')
        .eq('recurring_schedule_id', recurringScheduleId)
        .eq('status', 'cancelled')
        .gte('start_time', nowIso)
        .not('calendar_event_id', 'is', null)

      meetingsToProcess = (seriesMeetings || []) as MeetingRow[]
    }

    let deleted = 0
    let skipped = 0
    let failed = 0

    for (const meeting of meetingsToProcess) {
      const result = await deleteGoogleEventForMeeting(meeting)
      if (result === 'deleted') deleted += 1
      else if (result === 'skipped') skipped += 1
      else failed += 1
    }

    return new Response(
      JSON.stringify({
        success: true,
        deleted,
        skipped,
        failed,
        processed: meetingsToProcess.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})


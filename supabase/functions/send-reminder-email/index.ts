// Supabase Edge Function: Send Reminder Email
// This function sends reminder emails to meeting participants
// Can be called via scheduled job or cron

// @ts-ignore - Deno imports work at runtime in Supabase Edge Functions
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno imports work at runtime in Supabase Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Mailgun configuration
// @ts-ignore - Deno is available at runtime in Supabase Edge Functions
const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY') || ''
// @ts-ignore - Deno is available at runtime in Supabase Edge Functions
const MAILGUN_DOMAIN = Deno.env.get('MAILGUN_DOMAIN') || ''
// @ts-ignore - Deno is available at runtime in Supabase Edge Functions
const MAILGUN_FROM_EMAIL = Deno.env.get('MAILGUN_FROM_EMAIL') || `noreply@${MAILGUN_DOMAIN}`
// @ts-ignore - Deno is available at runtime in Supabase Edge Functions
const REMINDER_HOURS_BEFORE = parseInt(Deno.env.get('REMINDER_HOURS_BEFORE') || '24', 10)

// Helper function to send email via Mailgun
// Uses query string format (form-encoded body) similar to Java Unirest .queryString() approach
async function sendMailgunEmail(
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    throw new Error('Mailgun API key and domain must be configured')
  }

  // Build query string parameters (form-encoded body, like Java Unirest .queryString())
  const params = new URLSearchParams()
  params.append('from', MAILGUN_FROM_EMAIL)
  params.append('to', to)
  params.append('subject', subject)
  params.append('html', html)
  if (text) {
    params.append('text', text)
  }

  const auth = btoa(`api:${MAILGUN_API_KEY}`)
  const url = `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(), // Form-encoded body (like Unirest .queryString() for POST)
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Failed to send email')
    }

    return {
      success: true,
      messageId: data.id,
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error sending email',
    }
  }
}

// Format date and time for email
function formatMeetingDateTime(dateTime: string, timezone?: string): string {
  const date = new Date(dateTime)
  return date.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone || 'UTC',
  })
}

// Generate HTML reminder email template
function generateReminderEmail(
  participantName: string,
  meeting: any,
  eventType: any,
  hoursUntil: number
): string {
  const meetingDate = formatMeetingDateTime(meeting.start_time, meeting.timezone)
  const duration = eventType?.duration_minutes || meeting.end_time
    ? Math.round(
        (new Date(meeting.end_time).getTime() - new Date(meeting.start_time).getTime()) /
          60000
      )
    : 30

  // Determine location display
  let location = 'TBD'
  if (meeting.location) {
    location = meeting.location
  } else if (eventType?.location) {
    location = eventType.location
  } else if (meeting.location_type === 'video' || eventType?.location_type === 'video') {
    location = 'Video Call'
  } else if (meeting.location_type === 'phone' || eventType?.location_type === 'phone') {
    location = 'Phone Call'
  } else if (meeting.location_type === 'in_person' || eventType?.location_type === 'in_person') {
    location = 'In Person'
  }
  
  const meetingTitle = meeting.title || eventType?.name || 'Meeting'

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #102a43; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 24px; font-family: Georgia, serif;">Meeting Reminder</h1>
  </div>
  
  <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px;">Hi ${participantName},</p>
    
    <p style="font-size: 16px;">
      This is a reminder that you have a meeting coming up in ${hoursUntil} hour${hoursUntil !== 1 ? 's' : ''}!
    </p>
    
    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #102a43;">
      <h2 style="margin-top: 0; color: #1f2937;">${meetingTitle}</h2>
      
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; font-weight: bold; width: 120px;">Date & Time:</td>
          <td style="padding: 8px 0;">${meetingDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold;">Duration:</td>
          <td style="padding: 8px 0;">${duration} minutes</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold;">Location:</td>
          <td style="padding: 8px 0;">${location}</td>
        </tr>
      </table>
    </div>
    
    <p style="font-size: 16px; margin-top: 30px;">
      We look forward to meeting with you!
    </p>
    
    <p style="font-size: 16px; margin-top: 30px;">
      Best regards,<br>
      <strong>Planno</strong>
    </p>
  </div>
</body>
</html>
  `.trim()
}

serve(async (req) => {
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

    // Get meeting_id from request body or query params
    let body: any = {}
    if (req.method === 'POST') {
      try {
        body = await req.json()
      } catch {
        // If body is empty, use empty object
        body = {}
      }
    } else if (req.method === 'GET') {
      const url = new URL(req.url)
      body = {
        meeting_id: url.searchParams.get('meeting_id') || undefined,
        hours_before: url.searchParams.get('hours_before') || undefined,
      }
    }
    const { meeting_id, hours_before } = body

    // If meeting_id is provided, send reminder for that specific meeting
    if (meeting_id) {
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

      // Skip if meeting is cancelled or completed
      if (meeting.status !== 'confirmed') {
        return new Response(
          JSON.stringify({
            success: true,
            message: `Meeting status is ${meeting.status}, skipping reminder`,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      const eventType = Array.isArray(meeting.event_types)
        ? meeting.event_types[0]
        : meeting.event_types

      const participants = meeting.participants || []
      
      // Calculate actual hours until meeting
      const meetingTime = new Date(meeting.start_time)
      const now = new Date()
      const actualHoursUntil = Math.round((meetingTime.getTime() - now.getTime()) / (1000 * 60 * 60))
      const hoursUntil = hours_before || actualHoursUntil || REMINDER_HOURS_BEFORE

      const emailSubject = `Reminder: ${meeting.title || eventType?.name || 'Meeting'} in ${hoursUntil} hour${hoursUntil !== 1 ? 's' : ''}`

      const emailResults: Array<{ email: string; success: boolean; error?: string }> = []

      // Send reminder to all participants
      for (const participant of participants) {
        const emailHtml = generateReminderEmail(
          participant.name,
          meeting,
          eventType,
          hoursUntil
        )

        const result = await sendMailgunEmail(
          participant.email,
          emailSubject,
          emailHtml
        )

        emailResults.push({
          email: participant.email,
          success: result.success,
          error: result.error,
        })
      }

      const allSuccessful = emailResults.every((r) => r.success)

      return new Response(
        JSON.stringify({
          success: allSuccessful,
          message: allSuccessful
            ? 'Reminder emails sent successfully'
            : 'Some reminder emails failed',
          results: emailResults,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: allSuccessful ? 200 : 207,
        }
      )
    }

    // Otherwise, find meetings that need reminders
    // Calculate the time window: meetings starting between now + REMINDER_HOURS_BEFORE
    const now = new Date()
    const reminderWindowStart = new Date(now.getTime() + REMINDER_HOURS_BEFORE * 60 * 60 * 1000)
    const reminderWindowEnd = new Date(reminderWindowStart.getTime() + 60 * 60 * 1000) // 1 hour window

    const { data: upcomingMeetings, error: meetingsError } = await supabaseClient
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
      .eq('status', 'confirmed')
      .gte('start_time', reminderWindowStart.toISOString())
      .lte('start_time', reminderWindowEnd.toISOString())
      .order('start_time', { ascending: true })

    if (meetingsError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to fetch meetings: ' + (meetingsError.message || 'Unknown error'),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    if (!upcomingMeetings || upcomingMeetings.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No meetings need reminders at this time',
          count: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    const allResults: Array<{ meeting_id: string; results: any[] }> = []

    // Send reminders for all meetings
    for (const meeting of upcomingMeetings) {
      const eventType = Array.isArray(meeting.event_types)
        ? meeting.event_types[0]
        : meeting.event_types

      const participants = meeting.participants || []
      
      // Calculate actual hours until meeting
      const meetingTime = new Date(meeting.start_time)
      const now = new Date()
      const actualHoursUntil = Math.round((meetingTime.getTime() - now.getTime()) / (1000 * 60 * 60))
      const hoursUntil = actualHoursUntil || REMINDER_HOURS_BEFORE

      const emailSubject = `Reminder: ${meeting.title || eventType?.name || 'Meeting'} in ${hoursUntil} hour${hoursUntil !== 1 ? 's' : ''}`

      const meetingResults: Array<{ email: string; success: boolean; error?: string }> = []

      for (const participant of participants) {
        const emailHtml = generateReminderEmail(
          participant.name,
          meeting,
          eventType,
          hoursUntil
        )

        const result = await sendMailgunEmail(
          participant.email,
          emailSubject,
          emailHtml
        )

        meetingResults.push({
          email: participant.email,
          success: result.success,
          error: result.error,
        })
      }

      allResults.push({
        meeting_id: meeting.id,
        results: meetingResults,
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${upcomingMeetings.length} meeting(s)`,
        meetings_processed: upcomingMeetings.length,
        results: allResults,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})


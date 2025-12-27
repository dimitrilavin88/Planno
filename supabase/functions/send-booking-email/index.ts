// Supabase Edge Function: Send Booking Email
// This function sends confirmation emails and calendar invites via Mailgun
// Triggered after a meeting is booked

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
const SITE_URL = Deno.env.get('NEXT_PUBLIC_SITE_URL') || 'http://localhost:3000'

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

// Generate HTML email template
function generateConfirmationEmail(
  participantName: string,
  meeting: any,
  eventType: any,
  isHost: boolean
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
    location = 'Video Call (link will be sent)'
  } else if (meeting.location_type === 'phone' || eventType?.location_type === 'phone') {
    location = 'Phone Call (details will be sent)'
  } else if (meeting.location_type === 'in_person' || eventType?.location_type === 'in_person') {
    location = 'In Person (location TBD)'
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
    <h1 style="margin: 0; font-size: 24px; font-family: Georgia, serif;">Meeting Confirmed</h1>
  </div>
  
  <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px;">Hi ${participantName},</p>
    
    <p style="font-size: 16px;">Your meeting has been confirmed!</p>
    
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
    
    ${eventType?.description ? `<p style="color: #6b7280;">${eventType.description}</p>` : ''}
    
    <p style="font-size: 16px; margin-top: 30px;">
      You will receive a calendar invite shortly.
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

    // Handle both POST (from webhook) and GET (for testing)
    // Supabase webhooks may send data in query params or body
    let meeting_id: string | null = null
    
    // First, try to get from URL query parameters (for Supabase webhooks)
    const url = new URL(req.url)
    meeting_id = url.searchParams.get('meeting_id')
    
    // If not in query params, try request body (for direct API calls)
    if (!meeting_id && req.method === 'POST') {
      try {
        const body = await req.json()
        meeting_id = body.meeting_id || body.id || body.record?.id
      } catch {
        // Body parsing failed, already tried URL
      }
    }
    
    // Also check if Supabase webhook sent the row data directly
    if (!meeting_id && req.method === 'POST') {
      try {
        const body = await req.json()
        // Supabase webhooks might send: { type: 'INSERT', table: 'meetings', record: { id: '...' } }
        if (body.record?.id) {
          meeting_id = body.record.id
        } else if (body.id) {
          meeting_id = body.id
        }
      } catch {
        // Ignore
      }
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

    // Skip if meeting is cancelled
    if (meeting.status === 'cancelled') {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Meeting is cancelled, skipping email',
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
    const hostParticipant = participants.find((p: any) => p.is_host)
    const guestParticipants = participants.filter((p: any) => !p.is_host)

    if (participants.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No participants found for meeting',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    const meetingTitle = meeting.title || eventType?.name || 'Meeting'
    const emailSubject = `Meeting Confirmed: ${meetingTitle}`

    const emailResults: Array<{ email: string; success: boolean; error?: string }> = []

    // Send email to host
    if (hostParticipant) {
      const hostEmailHtml = generateConfirmationEmail(
        hostParticipant.name,
        meeting,
        eventType,
        true
      )
      
      const hostResult = await sendMailgunEmail(
        hostParticipant.email,
        emailSubject,
        hostEmailHtml
      )

      emailResults.push({
        email: hostParticipant.email,
        success: hostResult.success,
        error: hostResult.error,
      })
    }

    // Send email to all guest participants
    for (const guest of guestParticipants) {
      const guestEmailHtml = generateConfirmationEmail(
        guest.name,
        meeting,
        eventType,
        false
      )

      const guestResult = await sendMailgunEmail(
        guest.email,
        emailSubject,
        guestEmailHtml
      )

      emailResults.push({
        email: guest.email,
        success: guestResult.success,
        error: guestResult.error,
      })
    }

    const allSuccessful = emailResults.every((r) => r.success)
    const failedEmails = emailResults.filter((r) => !r.success)

    return new Response(
      JSON.stringify({
        success: allSuccessful,
        message: allSuccessful
          ? 'All emails sent successfully'
          : `Some emails failed: ${failedEmails.map((e) => e.email).join(', ')}`,
        results: emailResults,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: allSuccessful ? 200 : 207, // 207 Multi-Status for partial success
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


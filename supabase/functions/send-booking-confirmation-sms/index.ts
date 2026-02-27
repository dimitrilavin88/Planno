// Supabase Edge Function: send-booking-confirmation-sms
// Sends one SMS to the client immediately after they confirm a booking.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') || ''
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') || ''
const TWILIO_MESSAGING_SERVICE_SID = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID') || ''

function formatMeetingTime(startTime: string, timezone?: string | null): string {
  const date = new Date(startTime)
  try {
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone || 'UTC',
    })
  } catch {
    return date.toISOString()
  }
}

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10 && /^[2-9]/.test(digits)) {
    return `+1${digits}`
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }
  return digits ? `+${digits}` : phone
}

async function sendTwilioSms(to: string, body: string): Promise<{ success: boolean; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_MESSAGING_SERVICE_SID) {
    return { success: false, error: 'Twilio credentials are not configured' }
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`
  const params = new URLSearchParams()
  params.append('To', to)
  params.append('MessagingServiceSid', TWILIO_MESSAGING_SERVICE_SID)
  params.append('Body', body)

  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const data = await response.json()
    if (!response.ok) {
      return { success: false, error: data?.message || 'Failed to send SMS' }
    }
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Unknown error' }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const meetingId = typeof body?.meeting_id === 'string' ? body.meeting_id.trim() : ''
    const phoneNumber = typeof body?.phone_number === 'string' ? body.phone_number.trim() : ''

    if (!meetingId || !phoneNumber) {
      return new Response(
        JSON.stringify({ error: 'meeting_id and phone_number are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, start_time, timezone, title')
      .eq('id', meetingId)
      .single()

    if (meetingError || !meeting) {
      return new Response(
        JSON.stringify({ error: 'Meeting not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    const formattedTime = formatMeetingTime(meeting.start_time, meeting.timezone)
    const message = `Your meeting has been confirmed for ${formattedTime}. You'll receive a reminder 15 minutes before the start time.`

    const to = toE164(phoneNumber)
    const result = await sendTwilioSms(to, message)

    if (!result.success) {
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err: any) {
    console.error('send-booking-confirmation-sms:', err)
    return new Response(
      JSON.stringify({ error: err?.message || 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

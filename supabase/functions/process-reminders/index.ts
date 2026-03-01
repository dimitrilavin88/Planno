// Supabase Edge Function: process-reminders
// Picks up due SMS reminders and sends them via Twilio

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') || ''
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') || ''
const TWILIO_MESSAGING_SERVICE_SID = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID') || ''

const MAX_BATCH = 100
const CONCURRENCY = 10

interface ReminderRow {
  id: string
  booking_id: string
  phone_number: string | null
  scheduled_for: string
  status: 'pending' | 'sent' | 'delivered' | 'failed'
  retry_count: number
  last_error: string | null
  twilio_message_sid: string | null
  meeting: {
    id: string
    start_time: string
    timezone: string | null
    title: string | null
  } | null
}

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

async function sendTwilioSms(to: string, body: string): Promise<{ success: boolean; sid?: string; error?: string }> {
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
      return {
        success: false,
        error: data?.message || 'Failed to send SMS via Twilio',
      }
    }

    return {
      success: true,
      sid: data?.sid,
    }
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Unknown error sending SMS via Twilio',
    }
  }
}

const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Optional: require shared secret when set (e.g. for pg_net/cron calls)
  if (CRON_SECRET) {
    const authHeader = req.headers.get('authorization')
    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (bearer !== CRON_SECRET) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }
  }

  const nowIso = new Date().toISOString()

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

  try {
    // Fetch due reminders (pending and scheduled_for <= now)
    const { data: reminders, error } = await supabaseClient
      .from('reminders')
      .select(
        `
          id,
          booking_id,
          phone_number,
          scheduled_for,
          status,
          retry_count,
          last_error,
          twilio_message_sid,
          meeting:booking_id (
            id,
            start_time,
            timezone,
            title
          )
        `
      )
      .eq('status', 'pending')
      .lte('scheduled_for', nowIso)
      .order('scheduled_for', { ascending: true })
      .limit(MAX_BATCH)

    if (error) {
      console.error('process-reminders: failed to fetch reminders', error)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to fetch reminders',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    if (!reminders || reminders.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          sent: 0,
          failed: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const typedReminders = reminders as unknown as ReminderRow[]
    let processed = 0
    let sent = 0
    let failed = 0

    // Process in chunks to limit concurrency
    for (let i = 0; i < typedReminders.length; i += CONCURRENCY) {
      const chunk = typedReminders.slice(i, i + CONCURRENCY)

      const results = await Promise.all(
        chunk.map(async (reminder) => {
          processed += 1

          // Skip if phone number is missing
          if (!reminder.phone_number || reminder.phone_number.trim() === '') {
            failed += 1
            await supabaseClient
              .from('reminders')
              .update({
                status: 'failed',
                last_error: 'Missing phone number',
              })
              .eq('id', reminder.id)
            return
          }

          if (!reminder.meeting) {
            failed += 1
            await supabaseClient
              .from('reminders')
              .update({
                status: 'failed',
                last_error: 'Associated meeting not found',
              })
              .eq('id', reminder.id)
            return
          }

          const { meeting } = reminder
          const formattedTime = formatMeetingTime(meeting.start_time, meeting.timezone)
          const message = `Reminder: You have a meeting at ${formattedTime}. See details in your email.`

          const smsResult = await sendTwilioSms(reminder.phone_number, message)

          if (smsResult.success) {
            sent += 1
            await supabaseClient
              .from('reminders')
              .update({
                status: 'sent',
                retry_count: reminder.retry_count,
                last_error: null,
                twilio_message_sid: smsResult.sid ?? reminder.twilio_message_sid,
              })
              .eq('id', reminder.id)
          } else {
            failed += 1
            const nextRetry = (reminder.retry_count ?? 0) + 1
            const nextStatus = nextRetry >= 3 ? 'failed' : 'pending'
            await supabaseClient
              .from('reminders')
              .update({
                status: nextStatus,
                retry_count: nextRetry,
                last_error: smsResult.error ?? 'Unknown Twilio error',
              })
              .eq('id', reminder.id)
          }
        })
      )

      // Consume results to avoid eslint/TS complaints about unused variable
      void results
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        sent,
        failed,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err: any) {
    console.error('process-reminders: unexpected error', err)
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || 'Unknown error',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})


// Supabase Edge Function: twilio-webhook
// Receives status callbacks from Twilio and updates reminder delivery status

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') || ''

async function verifyTwilioSignature(req: Request): Promise<{ valid: boolean; params: URLSearchParams }> {
  const signature = req.headers.get('x-twilio-signature') || ''

  // Twilio sends application/x-www-form-urlencoded body
  const rawBody = await req.text()
  const params = new URLSearchParams(rawBody)

  if (!TWILIO_AUTH_TOKEN) {
    // If auth token is not configured, fail closed
    return { valid: false, params }
  }

  const url = req.url
  let dataToSign = url

  // Append form parameters in sorted order: key + value
  const keys = Array.from(params.keys()).sort()
  for (const key of keys) {
    const value = params.get(key) ?? ''
    dataToSign += key + value
  }

  const encoder = new TextEncoder()
  const keyData = encoder.encode(TWILIO_AUTH_TOKEN)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  )

  const mac = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(dataToSign))
  const macBytes = new Uint8Array(mac)
  let expectedSignature = ''
  for (let i = 0; i < macBytes.byteLength; i++) {
    expectedSignature += String.fromCharCode(macBytes[i])
  }
  expectedSignature = btoa(expectedSignature)

  return { valid: expectedSignature === signature, params }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { valid, params } = await verifyTwilioSignature(req)

    if (!valid) {
      console.error('twilio-webhook: invalid Twilio signature')
      return new Response('invalid signature', {
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
        status: 403,
      })
    }

    const messageSid =
      params.get('MessageSid') ||
      params.get('SmsSid') ||
      ''
    const messageStatusRaw =
      params.get('MessageStatus') ||
      params.get('SmsStatus') ||
      ''

    if (!messageSid) {
      return new Response('missing MessageSid', {
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
        status: 400,
      })
    }

    const messageStatus = messageStatusRaw.toLowerCase()

    // Map Twilio statuses to reminder_status
    let newStatus: 'delivered' | 'failed' | null = null
    if (messageStatus === 'delivered') {
      newStatus = 'delivered'
    } else if (messageStatus === 'failed' || messageStatus === 'undelivered') {
      newStatus = 'failed'
    }

    if (!newStatus) {
      // Ignore intermediate statuses like queued, sent, accepted
      return new Response('ok', {
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
        status: 200,
      })
    }

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

    const { data: reminder, error } = await supabaseClient
      .from('reminders')
      .select('id, status')
      .eq('twilio_message_sid', messageSid)
      .maybeSingle()

    if (error) {
      console.error('twilio-webhook: failed to lookup reminder', error)
      return new Response('error', {
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
        status: 500,
      })
    }

    if (!reminder) {
      // Nothing to update (idempotent)
      return new Response('ok', {
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
        status: 200,
      })
    }

    await supabaseClient
      .from('reminders')
      .update({
        status: newStatus,
        last_error: newStatus === 'failed' ? `Twilio status: ${messageStatusRaw}` : null,
      })
      .eq('id', reminder.id)

    return new Response('ok', {
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      status: 200,
    })
  } catch (err: any) {
    console.error('twilio-webhook: unexpected error', err)
    return new Response('error', {
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      status: 500,
    })
  }
})


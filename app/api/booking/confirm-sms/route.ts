import { NextRequest, NextResponse } from 'next/server'
import { requireApiRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const rateLimit = await requireApiRateLimit(request, 'api:confirm-sms', 10, 60)
  if (!rateLimit.ok) return rateLimit.response

  try {
    const body = await request.json()
    const meetingId = typeof body?.meetingId === 'string' ? body.meetingId.trim() : ''
    const phoneNumber = typeof body?.phoneNumber === 'string' ? body.phoneNumber.trim() : ''

    if (!meetingId || !phoneNumber) {
      return NextResponse.json(
        { error: 'meetingId and phoneNumber are required' },
        { status: 400 }
      )
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(meetingId)) {
      return NextResponse.json({ error: 'Invalid meeting ID format' }, { status: 400 })
    }

    const digits = phoneNumber.replace(/\D/g, '')
    if (digits.length !== 10) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      )
    }

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/send-booking-confirmation-sms`

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({
        meeting_id: meetingId,
        phone_number: digits,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorData: { error?: string } = {}
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { error: errorText }
      }
      return NextResponse.json(
        { error: errorData.error || `SMS failed: ${response.statusText}` },
        { status: response.status >= 500 ? 500 : 400 }
      )
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/utils'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const user = await requireAuth()
  const supabase = await createClient()

  try {
    const { meetingId } = await request.json()

    if (!meetingId) {
      return NextResponse.json(
        { error: 'Meeting ID is required' },
        { status: 400 }
      )
    }

    // Get Supabase URL and service role key from environment
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing Supabase config:', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!serviceRoleKey,
      })
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      )
    }

    // Call the Supabase Edge Function to create calendar events
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/create-calendar-event`
    console.log('Calling Edge Function:', edgeFunctionUrl)

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey, // Supabase Edge Functions also require apikey header
      },
      body: JSON.stringify({ meeting_id: meetingId }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { error: errorText }
      }
      console.error('Edge Function error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      })
      throw new Error(errorData.error || `Failed to sync calendar: ${response.statusText}`)
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    )
  }
}


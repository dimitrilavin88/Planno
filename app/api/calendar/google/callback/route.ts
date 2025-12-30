import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/utils'
import { NextResponse } from 'next/server'
import { type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const user = await requireAuth()
  const supabase = await createClient()

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL('/dashboard/calendar?error=access_denied', request.url))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/dashboard/calendar?error=invalid_request', request.url))
  }

  try {
    // Verify state
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
    if (stateData.userId !== user.id) {
      return NextResponse.redirect(new URL('/dashboard/calendar?error=invalid_state', request.url))
    }

    // Exchange authorization code for tokens
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 
      (process.env.NEXT_PUBLIC_SITE_URL 
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/calendar/google/callback`
        : process.env.VERCEL_URL 
          ? `https://${process.env.VERCEL_URL}/api/calendar/google/callback`
          : 'http://localhost:3000/api/calendar/google/callback')

    if (!clientId || !clientSecret) {
      console.error('Missing OAuth credentials:', { 
        hasClientId: !!clientId, 
        hasClientSecret: !!clientSecret 
      })
      return NextResponse.redirect(new URL('/dashboard/calendar?error=configuration_error', request.url))
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error('Token exchange error:', errorData)
      return NextResponse.redirect(new URL('/dashboard/calendar?error=token_exchange_failed', request.url))
    }

    const tokens = await tokenResponse.json()

    if (!tokens.access_token) {
      console.error('No access token in response:', tokens)
      return NextResponse.redirect(new URL('/dashboard/calendar?error=no_access_token', request.url))
    }

    // Get primary calendar ID
    let calendarId = 'primary'
    let calendarName = 'Primary Calendar'

    try {
      const calendarListResponse = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList/primary', {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      })

      if (calendarListResponse.ok) {
        const calendarInfo = await calendarListResponse.json()
        calendarId = calendarInfo.id || 'primary'
        calendarName = calendarInfo.summary || 'Primary Calendar'
      } else {
        // If we can't get calendar info, log it but continue with defaults
        const errorText = await calendarListResponse.text()
        console.warn('Could not fetch calendar info, using defaults:', errorText)
      }
    } catch (calendarError) {
      // If calendar fetch fails, use defaults and continue
      console.warn('Calendar info fetch failed, using defaults:', calendarError)
    }

    // Calculate token expiration
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null

    // Check if calendar connection already exists
    const { data: existingCalendar } = await supabase
      .from('calendars')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .eq('calendar_id', calendarId)
      .single()

    if (existingCalendar) {
      // Update existing connection
      await supabase
        .from('calendars')
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || existingCalendar.refresh_token,
          token_expires_at: expiresAt,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingCalendar.id)
    } else {
      // Create new connection
      // Check if this should be primary (first calendar for user)
      const { data: existingCalendars } = await supabase
        .from('calendars')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)

      await supabase
        .from('calendars')
        .insert({
          user_id: user.id,
          provider: 'google',
          calendar_id: calendarId,
          calendar_name: calendarName,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt,
          is_primary: existingCalendars?.length === 0, // First calendar is primary
          is_active: true,
        })
    }

    return NextResponse.redirect(new URL('/dashboard/calendar?success=connected', request.url))
  } catch (error: any) {
    console.error('Calendar connection error:', error)
    return NextResponse.redirect(new URL(`/dashboard/calendar?error=${encodeURIComponent(error.message || 'unknown_error')}`, request.url))
  }
}


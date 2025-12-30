import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/utils'
import { redirect } from 'next/navigation'

export async function GET(request: Request) {
  const user = await requireAuth()
  const supabase = await createClient()

  // Get Google OAuth credentials from environment
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 
    (process.env.NEXT_PUBLIC_SITE_URL 
      ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/calendar/google/callback`
      : process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}/api/calendar/google/callback`
        : 'http://localhost:3000/api/calendar/google/callback')

  if (!clientId) {
    console.error('GOOGLE_CLIENT_ID is not set')
    return new Response(
      JSON.stringify({ 
        error: 'Google OAuth not configured',
        details: 'GOOGLE_CLIENT_ID environment variable is missing'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Log for debugging (remove in production)
  console.log('OAuth redirect URI:', redirectUri)

  // Generate state parameter for security (store in session or use user ID)
  const state = Buffer.from(JSON.stringify({ userId: user.id })).toString('base64')

  // Google OAuth scopes - we need calendar write access
  const scopes = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly',
  ].join(' ')

  // Build Google OAuth URL
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', scopes)
  authUrl.searchParams.set('access_type', 'offline') // Required to get refresh token
  authUrl.searchParams.set('prompt', 'consent') // Force consent to get refresh token
  authUrl.searchParams.set('state', state)

  // Redirect to Google OAuth
  redirect(authUrl.toString())
}


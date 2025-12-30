import { requireAuth } from '@/lib/auth/utils'
import LogoutButton from '@/components/auth/logout-button'
import CopyButton from '@/components/copy-button'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import Logo from '@/components/logo'

export default async function DashboardPage() {
  const user = await requireAuth()
  const supabase = await createClient()

  // Check if user has completed profile setup
  const { data: userProfile } = await supabase
    .from('users')
    .select('username, timezone')
    .eq('id', user.id)
    .single()

  // If username is still temporary (starts with 'user_'), redirect to setup
  if (userProfile?.username?.startsWith('user_')) {
    redirect('/profile/setup')
  }

  const username = userProfile?.username || 'yourusername'
  // Get base URL: prefer NEXT_PUBLIC_SITE_URL, fallback to VERCEL_URL (auto-provided by Vercel), then localhost for dev
  const baseUrl = 
    process.env.NEXT_PUBLIC_SITE_URL || 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'http://localhost:3000'

  // Fetch user's availability rules
  const { data: availabilityRules } = await supabase
    .from('availability_rules')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_available', true)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })

  // Fetch user's event types
  const { data: eventTypes } = await supabase
    .from('event_types')
    .select('id, name, duration_minutes, is_active')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch user's connected calendars
  const { data: calendars } = await supabase
    .from('calendars')
    .select('provider, calendar_name, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: false })

  // Fetch upcoming meetings with participants and event types
  const { data: upcomingMeetings } = await supabase
    .from('meetings')
    .select(`
      id,
      title,
      start_time,
      end_time,
      status,
      event_types:event_type_id (
        name
      ),
      participants:meeting_participants (
        name,
        email,
        is_host
      )
    `)
    .eq('host_user_id', user.id)
    .in('status', ['confirmed', 'pending'])
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true })
    .limit(5)

  const DAYS = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ]

  // Group availability by day
  const availabilityByDay = DAYS.map((dayName, index) => ({
    dayName,
    dayIndex: index,
    rules: availabilityRules?.filter((rule) => rule.day_of_week === index) || [],
  }))

  // Format time for display (e.g., "09:00" -> "9:00 AM")
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours, 10)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  // Format date and time for meetings using user's timezone
  const formatMeetingDateTime = (dateTime: string) => {
    const userTimezone = userProfile?.timezone || 'UTC'
    const date = new Date(dateTime)
    
    // Create date formatter with user's timezone
    const timeOptions: Intl.DateTimeFormatOptions = { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true,
      timeZone: userTimezone
    }
    const dateOptions: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      timeZone: userTimezone
    }
    
    // Get today and tomorrow in user's timezone
    const now = new Date()
    const todayInTz = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }))
    const tomorrowInTz = new Date(todayInTz)
    tomorrowInTz.setDate(tomorrowInTz.getDate() + 1)
    
    const meetingDateInTz = new Date(date.toLocaleString('en-US', { timeZone: userTimezone }))
    const meetingDateStr = meetingDateInTz.toDateString()
    const todayStr = todayInTz.toDateString()
    const tomorrowStr = tomorrowInTz.toDateString()

    // Check if it's today
    if (meetingDateStr === todayStr) {
      return `Today at ${date.toLocaleTimeString('en-US', timeOptions)}`
    }
    // Check if it's tomorrow
    if (meetingDateStr === tomorrowStr) {
      return `Tomorrow at ${date.toLocaleTimeString('en-US', timeOptions)}`
    }
    // Otherwise show date and time
    const yearOptions = date.getFullYear() !== todayInTz.getFullYear() ? { year: 'numeric' as const } : {}
    return date.toLocaleDateString('en-US', {
      ...dateOptions,
      ...yearOptions,
    }) + ' at ' + date.toLocaleTimeString('en-US', timeOptions)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-navy-900 shadow-md border-b border-navy-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard">
                <Logo size="sm" className="text-white" />
              </Link>
              <span className="ml-3 text-lg font-serif font-semibold text-white">Dashboard</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-200">{user.email}</span>
              <LogoutButton />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-serif font-semibold text-navy-900 mb-4">
              Your Public Scheduling Page
            </h2>
            <div className="bg-gray-50 rounded-md p-4 mb-4">
              <p className="text-sm text-gray-600 mb-2">Share this link:</p>
              <div className="flex items-center space-x-2">
                <code className="flex-1 bg-white px-3 py-2 rounded border text-sm">
                  {baseUrl}/{username}
                </code>
                <CopyButton text={`${baseUrl}/${username}`} />
              </div>
            </div>
            <Link
              href={`/${username}`}
              target="_blank"
              className="text-navy-700 hover:text-navy-900 text-sm font-medium"
            >
              View your public page →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-6">
            <Link
              href="/dashboard/meetings"
              className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow flex flex-col"
            >
              <h3 className="text-xl font-serif font-semibold text-navy-900 mb-2 flex-shrink-0">Meetings</h3>
              {upcomingMeetings && upcomingMeetings.length > 0 ? (
                <div className="space-y-4 overflow-y-auto max-h-48 flex-1">
                  {upcomingMeetings.map((meeting: any) => {
                    const allParticipants = meeting.participants || []
                    const guests = allParticipants.filter((p: any) => !p.is_host) || []
                    const guestNames = guests.length > 0 ? guests.map((g: any) => g.name).join(', ') : null
                    // Get meeting title from event type or use meeting.title
                    const eventType = Array.isArray(meeting.event_types) ? meeting.event_types[0] : meeting.event_types
                    const meetingTitle = eventType?.name || meeting.title || 'Meeting'
                    return (
                      <div key={meeting.id} className="text-gray-600 text-sm">
                        <p>
                          <span className="font-medium">{meetingTitle}</span>
                        </p>
                        {allParticipants.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            {allParticipants.length === 1 ? (
                              <span>1 participant</span>
                            ) : (
                              <span>{allParticipants.length} participants</span>
                            )}
                            {guestNames && (
                              <span> - {guestNames}</span>
                            )}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {formatMeetingDateTime(meeting.start_time)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              ) : (
              <p className="text-gray-600 text-sm">
                View and manage your meetings
              </p>
              )}
            </Link>
            <Link
              href="/dashboard/availability"
              className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow flex flex-col"
            >
              <h3 className="text-xl font-serif font-semibold text-navy-900 mb-2 flex-shrink-0">Availability</h3>
              {availabilityRules && availabilityRules.length > 0 ? (
                <div className="space-y-4 overflow-y-auto max-h-48 flex-1">
                  {availabilityByDay
                    .filter((day) => day.rules.length > 0)
                    .map((day) => (
                      <p key={day.dayIndex} className="text-gray-600 text-sm">
                        <span className="font-medium">{day.dayName.substring(0, 3)}:</span>{' '}
                        {day.rules
                          .slice(0, 1)
                          .map((rule) => `${formatTime(rule.start_time)} - ${formatTime(rule.end_time)}`)
                          .join(', ')}
                        {day.rules.length > 1 && ' +' + (day.rules.length - 1)}
                      </p>
                    ))}
                </div>
              ) : (
              <p className="text-gray-600 text-sm">
                Set your weekly availability schedule
              </p>
              )}
            </Link>
            <Link
              href="/dashboard/event-types"
              className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow flex flex-col"
            >
              <h3 className="text-xl font-serif font-semibold text-navy-900 mb-2 flex-shrink-0">Event Types</h3>
              {eventTypes && eventTypes.length > 0 ? (
                <div className="space-y-4 overflow-y-auto max-h-48 flex-1">
                  {eventTypes
                    .filter((et) => et.is_active)
                    .map((eventType) => {
                      const hours = Math.floor(eventType.duration_minutes / 60)
                      const minutes = eventType.duration_minutes % 60
                      const duration =
                        hours > 0
                          ? `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`.trim()
                          : `${minutes}m`
                      return (
                        <p key={eventType.id} className="text-gray-600 text-sm">
                          <span className="font-medium">{eventType.name}</span> ({duration})
                        </p>
                      )
                    })}
                  {eventTypes.filter((et) => !et.is_active).length > 0 && (
                    <p className="text-gray-400 text-xs mt-1">
                      {eventTypes.filter((et) => !et.is_active).length} inactive
                    </p>
                  )}
                </div>
              ) : (
              <p className="text-gray-600 text-sm">
                Manage your meeting types and durations
              </p>
              )}
            </Link>
            <Link
              href="/dashboard/group-event-types"
              className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <h3 className="text-xl font-serif font-semibold text-navy-900 mb-2">Group Events</h3>
              <p className="text-gray-600 text-sm">
                Create events with multiple hosts
              </p>
            </Link>
            <Link
              href="/dashboard/calendar"
              className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow flex flex-col"
            >
              <h3 className="text-xl font-serif font-semibold text-navy-900 mb-2 flex-shrink-0">Calendar</h3>
              {calendars && calendars.length > 0 ? (
                <div className="space-y-4 overflow-y-auto max-h-48 flex-1">
                  {calendars.map((calendar, idx) => {
                    // Get provider display name
                    let providerName = ''
                    let providerIcon = null
                    if (calendar.provider === 'google') {
                      providerName = 'Google'
                      providerIcon = (
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                      )
                    } else if (calendar.provider === 'outlook') {
                      providerName = 'Outlook'
                      providerIcon = (
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#0078D4">
                          <path d="M7.5 11.5c0-.8-.7-1.5-1.5-1.5s-1.5.7-1.5 1.5.7 1.5 1.5 1.5 1.5-.7 1.5-1.5zm9-1.5c-.8 0-1.5.7-1.5 1.5s.7 1.5 1.5 1.5 1.5-.7 1.5-1.5-.7-1.5-1.5-1.5zM12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8z"/>
                        </svg>
                      )
                    } else if (calendar.provider === 'apple') {
                      providerName = 'Apple'
                      providerIcon = (
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.17 2.08-1.65 3.99-3.74 4.25z" fill="#000000"/>
                        </svg>
                      )
                    } else {
                      providerName = calendar.provider.charAt(0).toUpperCase() + calendar.provider.slice(1)
                    }
                    
                    // Always show the provider name (Google/Apple/Outlook) instead of calendar_name
                    // The calendar_name might be an email or other identifier
                    const displayName = providerName
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        {providerIcon && (
                          <div className="flex-shrink-0">
                            {providerIcon}
                          </div>
                        )}
                        <p className="text-gray-600 text-sm flex items-center gap-1">
                          <span className="font-medium text-green-700">✓</span>{' '}
                          <span className="font-medium">{displayName}</span>
                        </p>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-gray-600 text-sm">
                  Connect Google Calendar for automatic sync
                </p>
              )}
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-serif font-semibold text-navy-900 mb-4">Quick Info</h2>
              <p className="text-sm text-gray-600 mb-2">
              Timezone: <span className="font-medium">{userProfile?.timezone || 'UTC'}</span>
            </p>
              <Link
                href="/dashboard/availability"
                className="text-sm text-navy-700 hover:text-navy-900 font-medium"
              >
                Manage availability →
              </Link>
            </div>

            <div className="bg-white shadow rounded-lg p-6 flex flex-col">
              <h2 className="text-xl font-serif font-semibold text-navy-900 mb-4 flex-shrink-0">Your Availability</h2>
              {availabilityRules && availabilityRules.length > 0 ? (
                <div className="space-y-4 overflow-y-auto max-h-64 flex-1">
                  {availabilityByDay
                    .filter((day) => day.rules.length > 0)
                    .map((day) => (
                      <div key={day.dayIndex} className="text-sm">
                        <span className="font-medium text-gray-900">{day.dayName}:</span>{' '}
                        <span className="text-gray-600">
                          {day.rules.map((rule, idx) => (
                            <span key={rule.id || idx}>
                              {formatTime(rule.start_time)} - {formatTime(rule.end_time)}
                              {idx < day.rules.length - 1 ? ', ' : ''}
                            </span>
                          ))}
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">
                  <p>No availability set yet.</p>
                  <Link
                    href="/dashboard/availability"
                    className="text-navy-700 hover:text-navy-900 font-medium mt-2 inline-block"
                  >
                    Set your availability →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

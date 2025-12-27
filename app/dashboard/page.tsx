import { requireAuth } from '@/lib/auth/utils'
import LogoutButton from '@/components/auth/logout-button'
import CopyButton from '@/components/copy-button'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

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

  // Format date and time for meetings
  const formatMeetingDateTime = (dateTime: string) => {
    const date = new Date(dateTime)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Check if it's today
    if (date.toDateString() === today.toDateString()) {
      return `Today at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
    }
    // Check if it's tomorrow
    if (date.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
    }
    // Otherwise show date and time
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    }) + ' at ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-navy-900 shadow-md border-b border-navy-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-serif font-semibold text-white">Planno Dashboard</h1>
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <Link
              href="/dashboard/meetings"
              className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <h3 className="text-xl font-serif font-semibold text-navy-900 mb-2">Meetings</h3>
              {upcomingMeetings && upcomingMeetings.length > 0 ? (
                <div className="space-y-1">
                  {upcomingMeetings.slice(0, 3).map((meeting: any) => {
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
                  {upcomingMeetings.length > 3 && (
                    <p className="text-gray-500 text-xs mt-1">
                      +{upcomingMeetings.length - 3} more
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-gray-600 text-sm">
                  View and manage your meetings
                </p>
              )}
            </Link>
            <Link
              href="/dashboard/availability"
              className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <h3 className="text-xl font-serif font-semibold text-navy-900 mb-2">Availability</h3>
              {availabilityRules && availabilityRules.length > 0 ? (
                <div className="space-y-1">
                  {availabilityByDay
                    .filter((day) => day.rules.length > 0)
                    .slice(0, 3)
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
                  {availabilityByDay.filter((day) => day.rules.length > 0).length > 3 && (
                    <p className="text-gray-500 text-xs mt-1">
                      +{availabilityByDay.filter((day) => day.rules.length > 0).length - 3} more days
                    </p>
                  )}
                </div>
              ) : (
              <p className="text-gray-600 text-sm">
                Set your weekly availability schedule
              </p>
              )}
            </Link>
            <Link
              href="/dashboard/event-types"
              className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <h3 className="text-xl font-serif font-semibold text-navy-900 mb-2">Event Types</h3>
              {eventTypes && eventTypes.length > 0 ? (
                <div className="space-y-1">
                  {eventTypes
                    .filter((et) => et.is_active)
                    .slice(0, 3)
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
                  {eventTypes.filter((et) => et.is_active).length > 3 && (
                    <p className="text-gray-500 text-xs mt-1">
                      +{eventTypes.filter((et) => et.is_active).length - 3} more
                    </p>
                  )}
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

            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-serif font-semibold text-navy-900 mb-4">Your Availability</h2>
              {availabilityRules && availabilityRules.length > 0 ? (
                <div className="space-y-2">
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

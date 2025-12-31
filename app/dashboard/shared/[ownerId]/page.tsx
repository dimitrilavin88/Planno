import { requireAuth } from '@/lib/auth/utils'
import { createClient } from '@/lib/supabase/server'
import { checkDashboardAccess } from '@/lib/dashboard-access/utils'
import { redirect } from 'next/navigation'
import LogoutButton from '@/components/auth/logout-button'
import Logo from '@/components/logo'
import Link from 'next/link'
import CopyButton from '@/components/copy-button'

interface PageProps {
  params: Promise<{ ownerId: string }>
}

export default async function SharedDashboardPage({ params }: PageProps) {
  const user = await requireAuth()
  const resolvedParams = await params
  const ownerId = resolvedParams.ownerId
  const supabase = await createClient()

  // Check if user has access to this dashboard
  const access = await checkDashboardAccess(user.id, ownerId, 'view')
  
  if (!access.hasAccess) {
    redirect('/dashboard')
  }

  // Get owner's username for display
  const { data: ownerProfile } = await supabase
    .from('users')
    .select('username')
    .eq('id', ownerId)
    .single()

  // Get owner's display name (from auth metadata, falls back to username)
  const { data: ownerDisplayName } = await supabase.rpc('get_user_display_name', {
    p_user_id: ownerId
  })

  const displayName = (ownerDisplayName && typeof ownerDisplayName === 'string') 
    ? ownerDisplayName 
    : ownerProfile?.username || 'User'
  const username = ownerProfile?.username || 'user'
  const baseUrl = 
    process.env.NEXT_PUBLIC_SITE_URL || 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'http://localhost:3000'

  // Fetch owner's availability rules
  const { data: availabilityRules } = await supabase
    .from('availability_rules')
    .select('*')
    .eq('user_id', ownerId)
    .eq('is_available', true)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })

  // Fetch owner's event types
  const { data: eventTypes } = await supabase
    .from('event_types')
    .select('id, name, duration_minutes, is_active')
    .eq('user_id', ownerId)
    .order('created_at', { ascending: false })

  // Fetch upcoming meetings
  const { data: upcomingMeetings } = await supabase
    .from('meetings')
    .select(`
      *,
      event_types:event_type_id (
        name,
        location_type,
        location
      ),
      participants:meeting_participants (
        name,
        email,
        is_host
      )
    `)
    .eq('host_user_id', ownerId)
    .in('status', ['confirmed', 'pending'])
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true })
    .limit(5)

  // Get owner's timezone
  const { data: ownerUserProfile } = await supabase
    .from('users')
    .select('timezone')
    .eq('id', ownerId)
    .single()

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

  // Format date and time for meetings using owner's timezone
  const formatMeetingDateTime = (dateTime: string) => {
    const ownerTimezone = ownerUserProfile?.timezone || 'UTC'
    const date = new Date(dateTime)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: ownerTimezone
    }) + ' at ' + date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: ownerTimezone
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <nav className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-8">
              <Link href="/dashboard" className="flex items-center hover:opacity-90 transition-opacity group">
                <Logo size="lg" variant="light" showText={false} />
              </Link>
              <div className="hidden md:flex items-center space-x-1">
                <Link
                  href="/dashboard/meetings"
                  className="px-4 py-2 text-sm font-semibold text-navy-700 hover:text-navy-900 hover:bg-navy-50 rounded-lg transition-all"
                >
                  Meetings
                </Link>
                <Link
                  href="/dashboard/availability"
                  className="px-4 py-2 text-sm font-semibold text-navy-700 hover:text-navy-900 hover:bg-navy-50 rounded-lg transition-all"
                >
                  Availability
                </Link>
                <Link
                  href="/dashboard/event-types"
                  className="px-4 py-2 text-sm font-semibold text-navy-700 hover:text-navy-900 hover:bg-navy-50 rounded-lg transition-all"
                >
                  Event Types
                </Link>
                <Link
                  href="/dashboard/group-event-types"
                  className="px-4 py-2 text-sm font-semibold text-navy-700 hover:text-navy-900 hover:bg-navy-50 rounded-lg transition-all"
                >
                  Group Events
                </Link>
                <Link
                  href="/dashboard/calendar"
                  className="px-4 py-2 text-sm font-semibold text-navy-700 hover:text-navy-900 hover:bg-navy-50 rounded-lg transition-all"
                >
                  Calendar
                </Link>
                <Link
                  href="/dashboard/sharing"
                  className="px-4 py-2 text-sm font-semibold text-navy-700 hover:text-navy-900 hover:bg-navy-50 rounded-lg transition-all"
                >
                  Sharing
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600 hidden sm:block">{user.email}</span>
              <LogoutButton />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-10 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          <div className="mb-8 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-4xl font-serif font-bold text-navy-900 tracking-tight">
                  {displayName}'s Dashboard
                </h1>
                <p className="mt-2 text-gray-600 text-lg">
                  {access.permissionLevel === 'edit' 
                    ? 'You have edit access to this dashboard' 
                    : 'You have view-only access to this dashboard'}
                </p>
              </div>
              <Link
                href="/dashboard"
                className="px-4 py-2 text-sm font-semibold text-navy-700 bg-navy-50 border border-navy-200 rounded-lg hover:bg-navy-100 transition-all"
              >
                My Dashboard
              </Link>
            </div>
          </div>

          {/* Public Scheduling Page Section */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-10 mb-10 hover:shadow-2xl transition-all duration-300 animate-fade-in">
            <h2 className="text-3xl font-serif font-bold text-navy-900 mb-6 tracking-tight">
              Public Scheduling Page
            </h2>
            <div className="bg-gradient-to-r from-navy-50/80 to-gray-50/80 backdrop-blur-sm rounded-xl p-6 mb-6 border border-navy-100/50 shadow-sm">
              <p className="text-sm font-semibold text-navy-800 mb-4">Share this link:</p>
              <div className="flex items-center space-x-3">
                <code className="flex-1 bg-white/90 backdrop-blur-sm px-5 py-3.5 rounded-xl border border-gray-200/50 text-sm font-mono text-navy-900 shadow-inner">
                  {baseUrl}/{username}
                </code>
                <CopyButton text={`${baseUrl}/${username}`} />
              </div>
            </div>
            <Link
              href={`/${username}`}
              target="_blank"
              className="inline-flex items-center text-navy-700 hover:text-navy-900 text-sm font-semibold transition-all group hover:gap-2 gap-1.5"
            >
              View public page
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>

          {/* Quick Stats Cards - Clickable sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-10">
            {/* Meetings Card */}
            <Link
              href={`/dashboard/shared/${ownerId}/meetings`}
              className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-7 hover:shadow-2xl hover:border-navy-300/50 hover:-translate-y-1 transition-all duration-300 flex flex-col group"
            >
              <h3 className="text-xl font-serif font-bold text-navy-900 mb-4 flex-shrink-0 group-hover:text-navy-700 transition-colors">Meetings</h3>
              {upcomingMeetings && upcomingMeetings.length > 0 ? (
                <div className="space-y-4 overflow-y-scroll max-h-48 flex-1 dashboard-scrollable">
                  {upcomingMeetings.map((meeting: any) => {
                    const allParticipants = meeting.participants || []
                    const guests = allParticipants.filter((p: any) => !p.is_host) || []
                    const guestNames = guests.length > 0 ? guests.map((g: any) => g.name).join(', ') : null
                    const eventType = Array.isArray(meeting.event_types) ? meeting.event_types[0] : meeting.event_types
                    const meetingTitle = eventType?.name || meeting.title || 'Meeting'
                    return (
                      <div key={meeting.id} className="text-gray-700 text-sm p-4 rounded-xl bg-gradient-to-r from-gray-50 to-white hover:from-navy-50 hover:to-navy-100/50 transition-all duration-300 border border-gray-200/50 hover:border-navy-300/50 hover:shadow-md">
                        <p>
                          <span className="font-semibold text-navy-900">{meetingTitle}</span>
                        </p>
                        {allParticipants.length > 0 && (
                          <p className="text-xs text-gray-600 mt-2">
                            {allParticipants.length === 1 ? (
                              <span>1 participant</span>
                            ) : (
                              <span>{allParticipants.length} participants</span>
                            )}
                            {guestNames && (
                              <span className="text-navy-700"> - {guestNames}</span>
                            )}
                          </p>
                        )}
                        <p className="text-xs text-gray-600 mt-2 font-medium">
                          {formatMeetingDateTime(meeting.start_time)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-gray-600 text-sm">No upcoming meetings</p>
              )}
            </Link>

            {/* Availability Card */}
            <Link
              href={`/dashboard/shared/${ownerId}/availability`}
              className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-7 hover:shadow-2xl hover:border-navy-300/50 hover:-translate-y-1 transition-all duration-300 flex flex-col group"
            >
              <h3 className="text-xl font-serif font-bold text-navy-900 mb-4 flex-shrink-0 group-hover:text-navy-700 transition-colors">Availability</h3>
              {availabilityRules && availabilityRules.length > 0 ? (
                <div className="space-y-4 overflow-y-scroll max-h-48 flex-1 dashboard-scrollable">
                  {availabilityByDay
                    .filter((day) => day.rules.length > 0)
                    .map((day) => (
                      <p key={day.dayIndex} className="text-gray-700 text-sm p-4 rounded-xl bg-gradient-to-r from-gray-50 to-white hover:from-navy-50 hover:to-navy-100/50 transition-all duration-300 border border-gray-200/50 hover:border-navy-300/50 hover:shadow-md">
                        <span className="font-semibold text-navy-900">{day.dayName.substring(0, 3)}:</span>{' '}
                        <span className="text-gray-700">
                          {day.rules
                            .slice(0, 1)
                            .map((rule) => `${formatTime(rule.start_time)} - ${formatTime(rule.end_time)}`)
                            .join(', ')}
                          {day.rules.length > 1 && <span className="text-navy-600"> +{day.rules.length - 1}</span>}
                        </span>
                      </p>
                    ))}
                </div>
              ) : (
                <p className="text-gray-600 text-sm">
                  Set your weekly availability schedule
                </p>
              )}
            </Link>

            {/* Event Types Card */}
            <Link
              href={`/dashboard/shared/${ownerId}/event-types`}
              className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-7 hover:shadow-2xl hover:border-navy-300/50 hover:-translate-y-1 transition-all duration-300 flex flex-col group"
            >
              <h3 className="text-xl font-serif font-bold text-navy-900 mb-4 flex-shrink-0 group-hover:text-navy-700 transition-colors">Event Types</h3>
              {eventTypes && eventTypes.length > 0 ? (
                <div className="space-y-4 overflow-y-scroll max-h-48 flex-1 dashboard-scrollable">
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
                        <p key={eventType.id} className="text-gray-700 text-sm p-4 rounded-xl bg-gradient-to-r from-gray-50 to-white hover:from-navy-50 hover:to-navy-100/50 transition-all duration-300 border border-gray-200/50 hover:border-navy-300/50 hover:shadow-md">
                          <span className="font-semibold text-navy-900">{eventType.name}</span>{' '}
                          <span className="text-gray-600">({duration})</span>
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
          </div>

          {/* Edit Access Notice */}
          {access.permissionLevel === 'edit' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
              <p className="text-sm text-blue-800 font-semibold">
                You have edit access. You can modify this dashboard's settings.
              </p>
            </div>
          )}

          {/* View-Only Notice */}
          {access.permissionLevel === 'view' && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-8">
              <p className="text-sm text-gray-700 font-semibold">
                You have view-only access. Contact the dashboard owner to request edit permissions.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}


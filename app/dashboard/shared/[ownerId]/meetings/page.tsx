import { requireAuth } from '@/lib/auth/utils'
import { createClient } from '@/lib/supabase/server'
import { checkDashboardAccess } from '@/lib/dashboard-access/utils'
import { redirect } from 'next/navigation'
import MeetingsList from '@/components/meetings/meetings-list'
import LogoutButton from '@/components/auth/logout-button'
import Logo from '@/components/logo'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ ownerId: string }>
}

export default async function SharedMeetingsPage({ params }: PageProps) {
  const user = await requireAuth()
  const resolvedParams = await params
  const ownerId = resolvedParams.ownerId
  const supabase = await createClient()

  // Check if user has access to this dashboard
  const access = await checkDashboardAccess(user.id, ownerId, 'view')
  
  if (!access.hasAccess) {
    redirect('/dashboard')
  }

  // Get owner's display name
  const { data: ownerDisplayName } = await supabase.rpc('get_user_display_name', {
    p_user_id: ownerId
  })

  // Get owner's timezone
  const { data: ownerUserProfile } = await supabase
    .from('users')
    .select('timezone')
    .eq('id', ownerId)
    .single()

  // Fetch upcoming meetings for owner
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

  // Fetch past meetings for owner
  const { data: pastMeetings } = await supabase
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
    .in('status', ['confirmed', 'completed'])
    .lt('start_time', new Date().toISOString())
    .order('start_time', { ascending: false })
    .limit(20)

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

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link
              href={`/dashboard/shared/${ownerId}`}
              className="inline-flex items-center text-navy-700 hover:text-navy-900 text-sm font-semibold transition-all group mb-2"
            >
              <span className="group-hover:-translate-x-1 transition-transform">←</span>
              <span className="ml-1">Back to {ownerDisplayName || 'Dashboard'}'s Dashboard</span>
            </Link>
            <h1 className="text-3xl font-serif font-bold text-navy-900">
              {ownerDisplayName || 'User'}'s Meetings
            </h1>
            <p className="mt-2 text-gray-600">
              {access.permissionLevel === 'edit' 
                ? 'Manage meetings for this dashboard' 
                : 'View meetings for this dashboard'}
            </p>
          </div>
        </div>

        <MeetingsList
          upcomingMeetings={upcomingMeetings || []}
          pastMeetings={pastMeetings || []}
          userTimezone={ownerUserProfile?.timezone || 'UTC'}
          isSharedDashboard={true}
          canEdit={access.permissionLevel === 'edit'}
          ownerId={ownerId}
        />
      </main>
    </div>
  )
}


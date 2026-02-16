import { requireAuth } from '@/lib/auth/utils'
import { createClient } from '@/lib/supabase/server'
import { checkDashboardAccess } from '@/lib/dashboard-access/utils'
import { redirect } from 'next/navigation'
import MeetingsList from '@/components/meetings/meetings-list'
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
    <main className="max-w-7xl mx-auto py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link
              href={`/dashboard/shared/${ownerId}`}
              className="inline-flex items-center text-navy-700 hover:text-navy-900 text-sm font-semibold transition-all group mb-2"
            >
              <span className="group-hover:-translate-x-1 transition-transform">←</span>
              <span className="ml-1">Back to {ownerDisplayName || 'Dashboard'}&apos;s Dashboard</span>
            </Link>
            <h1 className="text-3xl font-serif font-bold text-navy-900">
              {ownerDisplayName || 'User'}&apos;s Meetings
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
  )
}


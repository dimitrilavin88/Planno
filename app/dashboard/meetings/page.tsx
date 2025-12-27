import { requireAuth } from '@/lib/auth/utils'
import { createClient } from '@/lib/supabase/server'
import MeetingsList from '@/components/meetings/meetings-list'
import Link from 'next/link'

export default async function MeetingsPage() {
  const user = await requireAuth()
  const supabase = await createClient()

  // Get user's timezone
  const { data: userProfile } = await supabase
    .from('users')
    .select('timezone')
    .eq('id', user.id)
    .single()

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
    .eq('host_user_id', user.id)
    .in('status', ['confirmed', 'pending'])
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true })

  // Fetch past meetings
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
    .eq('host_user_id', user.id)
    .in('status', ['confirmed', 'completed'])
    .lt('start_time', new Date().toISOString())
    .order('start_time', { ascending: false })
    .limit(20)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold text-navy-900">Meetings</h1>
            <p className="mt-2 text-gray-600">
              Manage your upcoming and past meetings
            </p>
          </div>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>

        <MeetingsList
          upcomingMeetings={upcomingMeetings || []}
          pastMeetings={pastMeetings || []}
          userTimezone={userProfile?.timezone || 'UTC'}
        />
      </div>
    </div>
  )
}


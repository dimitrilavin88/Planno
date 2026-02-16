import { requireAuth } from '@/lib/auth/utils'
import { createClient } from '@/lib/supabase/server'
import MeetingsContent from '@/components/meetings/meetings-content'

export default async function MeetingsPage() {
  const user = await requireAuth()
  const supabase = await createClient()

  // Get user's timezone
  const { data: userProfile } = await supabase
    .from('users')
    .select('timezone')
    .eq('id', user.id)
    .single()

  // Fetch user's event types and group event types (for Create Meeting)
  const { data: eventTypes } = await supabase
    .from('event_types')
    .select('id, name, duration_minutes')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('name')

  const { data: groupEventTypesRaw } = await supabase
    .from('group_event_types')
    .select(`
      id,
      name,
      duration_minutes,
      hosts:group_event_type_hosts ( user_id )
    `)
    .eq('is_active', true)

  const groupEventTypes =
    groupEventTypesRaw?.filter((g: any) =>
      Array.isArray(g.hosts) ? g.hosts.some((h: any) => h.user_id === user.id) : false
    ) || []

  // Fetch meetings via RPC (bypasses RLS; function filters by auth.uid() as host or participant)
  const { data: upcomingMeetings } = await supabase.rpc('get_my_meetings', { p_upcoming: true })
  const { data: pastMeetings } = await supabase.rpc('get_my_meetings', { p_upcoming: false })

  const eventTypesForModal = eventTypes || []
  const groupEventTypesForModal = groupEventTypes.map((g: any) => ({
    id: g.id,
    name: g.name,
    duration_minutes: g.duration_minutes,
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
        <MeetingsContent
          upcomingMeetings={upcomingMeetings || []}
          pastMeetings={pastMeetings || []}
          userTimezone={userProfile?.timezone || 'UTC'}
          eventTypes={eventTypesForModal}
          groupEventTypes={groupEventTypesForModal}
        />
      </div>
    </div>
  )
}


import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import GroupBookingFlow from '@/components/booking/group-booking-flow'

interface PageProps {
  params: Promise<{
    bookingLink: string
  }>
}

export default async function GroupBookPage({ params }: PageProps) {
  const { bookingLink } = await params
  const supabase = await createClient()

  // Fetch group event type by booking link
  const { data: groupEventType, error } = await supabase
    .from('group_event_types')
    .select(`
      *,
      hosts:group_event_type_hosts (
        user_id,
        users:user_id (
          id,
          username,
          timezone
        )
      )
    `)
    .eq('booking_link', bookingLink)
    .eq('is_active', true)
    .single()

  if (error || !groupEventType) {
    notFound()
  }

  const hosts = Array.isArray(groupEventType.hosts)
    ? groupEventType.hosts.map((h: any) => h.users).filter(Boolean)
    : []

  if (hosts.length === 0) {
    notFound()
  }

  // Use first host's timezone as default
  const defaultTimezone = hosts[0]?.timezone || 'UTC'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{groupEventType.name}</h1>
          {groupEventType.description && (
            <p className="text-gray-600 mb-2">{groupEventType.description}</p>
          )}
          <div className="mb-4">
            <p className="text-sm text-gray-500">Hosts: {hosts.map((h: any) => h.username).join(', ')}</p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-6">
            <span>Duration: {groupEventType.duration_minutes} minutes</span>
            <span>Type: {groupEventType.location_type}</span>
            {groupEventType.location && <span>Location: {groupEventType.location}</span>}
          </div>

          <GroupBookingFlow
            groupEventTypeId={groupEventType.id}
            durationMinutes={groupEventType.duration_minutes}
            locationType={groupEventType.location_type}
            location={groupEventType.location}
            defaultTimezone={defaultTimezone}
          />
        </div>
      </div>
    </div>
  )
}


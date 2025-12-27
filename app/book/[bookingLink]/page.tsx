import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import BookingFlow from '@/components/booking/booking-flow'

interface PageProps {
  params: Promise<{
    bookingLink: string
  }>
}

export default async function BookPage({ params }: PageProps) {
  const { bookingLink } = await params
  const supabase = await createClient()

  // Fetch event type by booking link
  const { data: eventType, error } = await supabase
    .from('event_types')
    .select(`
      *,
      users:user_id (
        id,
        username,
        timezone
      )
    `)
    .eq('booking_link', bookingLink)
    .eq('is_active', true)
    .single()

  if (error || !eventType) {
    notFound()
  }

  const host = Array.isArray(eventType.users) ? eventType.users[0] : eventType.users

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{eventType.name}</h1>
          {eventType.description && (
            <p className="text-gray-600 mb-6">{eventType.description}</p>
          )}
          <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-6">
            <span>Duration: {eventType.duration_minutes} minutes</span>
            <span>Type: {eventType.location_type}</span>
            {eventType.location && <span>Location: {eventType.location}</span>}
          </div>

          <BookingFlow
            eventTypeId={eventType.id}
            hostUserId={host.id}
            hostTimezone={host.timezone}
            durationMinutes={eventType.duration_minutes}
            locationType={eventType.location_type}
            location={eventType.location}
          />
        </div>
      </div>
    </div>
  )
}


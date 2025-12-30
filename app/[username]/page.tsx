import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/logo'

interface PageProps {
  params: Promise<{
    username: string
  }>
}

export default async function UserSchedulingPage({ params }: PageProps) {
  const { username } = await params
  const supabase = await createClient()

  // Fetch user by username
  const { data: user, error } = await supabase
    .from('users')
    .select('id, username, timezone')
    .eq('username', username.toLowerCase())
    .single()

  if (error || !user) {
    notFound()
  }

  // Get user's display name from auth metadata
  const { data: displayNameData, error: displayNameError } = await supabase.rpc('get_user_display_name', {
    p_user_id: user.id
  })
  // Use display name from metadata, fallback to username if not available
  const displayName = (displayNameData && typeof displayNameData === 'string') ? displayNameData : username

  // Fetch active event types for this user
  const { data: eventTypes } = await supabase
    .from('event_types')
    .select('id, name, description, duration_minutes, booking_link')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('name')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex justify-center">
          <Logo size="md" href="/" />
        </div>
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-serif font-bold text-navy-900 mb-2">
            Schedule a meeting with {displayName}
          </h1>
          <p className="text-gray-600 mb-8">
            Select an event type below to see available times
          </p>

          {eventTypes && eventTypes.length > 0 ? (
            <div className="space-y-4">
              {eventTypes.map((eventType) => (
                <Link
                  key={eventType.id}
                  href={`/book/${eventType.booking_link}`}
                  className="block p-6 border border-gray-200 rounded-lg hover:border-navy-700 hover:shadow-md transition-all"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        {eventType.name}
                      </h3>
                      {eventType.description && (
                        <p className="text-gray-600 mb-2">{eventType.description}</p>
                      )}
                      <p className="text-sm text-gray-500">
                        Duration: {eventType.duration_minutes} minutes
                      </p>
                    </div>
                    <div className="ml-4">
                      <span className="text-navy-700 font-medium">Book →</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600">
                No event types available at the moment.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


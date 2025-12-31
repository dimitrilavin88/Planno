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
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/50 p-10 animate-fade-in">
          <h1 className="text-4xl font-serif font-bold text-navy-900 mb-4 tracking-tight">
            Schedule a meeting with {displayName}
          </h1>
          <p className="text-gray-600 mb-10 text-lg">
            Select an event type below to see available times
          </p>

          {eventTypes && eventTypes.length > 0 ? (
            <div className="space-y-5">
              {eventTypes.map((eventType) => (
                <Link
                  key={eventType.id}
                  href={`/book/${eventType.booking_link}`}
                  className="block p-7 border-2 border-gray-200/50 rounded-2xl hover:border-navy-400/50 hover:shadow-2xl transition-all duration-300 bg-gradient-to-r from-gray-50/80 to-white hover:from-navy-50/80 hover:to-navy-100/50 group hover:-translate-y-1"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-2xl font-bold text-navy-900 mb-3 group-hover:text-navy-700 transition-colors">
                        {eventType.name}
                      </h3>
                      {eventType.description && (
                        <p className="text-gray-600 mb-3 text-base">{eventType.description}</p>
                      )}
                      <p className="text-sm font-semibold text-navy-600">
                        Duration: {eventType.duration_minutes} minutes
                      </p>
                    </div>
                    <div className="ml-4">
                      <span className="text-navy-700 font-bold text-lg group-hover:translate-x-2 transition-transform inline-block">→</span>
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


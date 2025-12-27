import { requireAuth } from '@/lib/auth/utils'
import { createClient } from '@/lib/supabase/server'
import EventTypesManager from '@/components/event-types/event-types-manager'
import Link from 'next/link'

export default async function EventTypesPage() {
  const user = await requireAuth()
  const supabase = await createClient()

  // Fetch user's event types
  const { data: eventTypes } = await supabase
    .from('event_types')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold text-navy-900">Event Types</h1>
            <p className="mt-2 text-gray-600">
              Create and manage different types of meetings that others can book with you.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>

        <EventTypesManager initialEventTypes={eventTypes || []} />
      </div>
    </div>
  )
}


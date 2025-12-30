import { requireAuth } from '@/lib/auth/utils'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import CalendarSettings from '@/components/calendar/calendar-settings'

interface PageProps {
  searchParams: Promise<{
    success?: string
    error?: string
  }>
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const user = await requireAuth()
  const supabase = await createClient()
  const params = await searchParams

  // Fetch user's connected calendars
  const { data: calendars } = await supabase
    .from('calendars')
    .select('*')
    .eq('user_id', user.id)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold text-navy-900">Calendar Integration</h1>
            <p className="mt-2 text-gray-600">
              Connect your calendar to automatically sync meetings
            </p>
          </div>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>

        {params.success && (
          <div className="mb-4 rounded-md bg-green-50 p-4">
            <p className="text-sm text-green-800">
              {params.success === 'connected' && 'Google Calendar connected successfully!'}
            </p>
          </div>
        )}

        {params.error && (
          <div className="mb-4 rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">
              Error: {params.error === 'access_denied' 
                ? 'Calendar access was denied. Please try again.' 
                : params.error}
            </p>
          </div>
        )}

        <CalendarSettings initialCalendars={calendars || []} />
      </div>
    </div>
  )
}


import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { RedirectToHostScheduling } from './redirect-component'

interface PageProps {
  params: Promise<{
    meetingId: string
  }>
}

export default async function BookingConfirmedPage({ params }: PageProps) {
  const { meetingId } = await params
  const supabase = await createClient()

  // Fetch meeting details with host username
  const { data: meeting, error } = await supabase
    .from('meetings')
    .select(`
      *,
      event_types:event_type_id (
        name,
        location_type,
        location
      ),
      host:host_user_id (
        username
      )
    `)
    .eq('id', meetingId)
    .single()

  if (error || !meeting) {
    notFound()
  }

  const eventType = Array.isArray(meeting.event_types)
    ? meeting.event_types[0]
    : meeting.event_types

  const host = Array.isArray(meeting.host) ? meeting.host[0] : meeting.host
  const hostUsername = host?.username

  const startDate = new Date(meeting.start_time)
  const endDate = new Date(meeting.end_time)

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h1>
          <p className="text-gray-600 mb-6">
            Your meeting has been successfully scheduled.
          </p>

          <div className="bg-gray-50 rounded-lg p-6 mb-6 text-left">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{eventType.name}</h2>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-start">
                <span className="font-medium text-gray-700 w-20">Date:</span>
                <span className="text-gray-900">
                  {startDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>

              <div className="flex items-start">
                <span className="font-medium text-gray-700 w-20">Time:</span>
                <span className="text-gray-900">
                  {startDate.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                  {' - '}
                  {endDate.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </span>
              </div>

              {eventType.location && (
                <div className="flex items-start">
                  <span className="font-medium text-gray-700 w-20">Location:</span>
                  <span className="text-gray-900">{eventType.location}</span>
                </div>
              )}

              {eventType.location_type === 'video' && (
                <div className="flex items-start">
                  <span className="font-medium text-gray-700 w-20">Type:</span>
                  <span className="text-gray-900">Video Call</span>
                </div>
              )}
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-6">
            A confirmation email has been sent to your email address with meeting details and
            calendar invite.
          </p>

          <div className="space-y-3">
            {hostUsername && (
              <RedirectToHostScheduling hostUsername={hostUsername} />
            )}
            <Link
              href={hostUsername ? `/${hostUsername}` : '/'}
              className="block w-full px-4 py-2 bg-navy-900 text-white rounded-md hover:bg-navy-800 text-center transition-colors"
            >
              {hostUsername ? `Back to ${hostUsername}'s Scheduling` : 'Back to Home'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}


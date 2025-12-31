import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import AddToCalendarButton from './add-to-calendar-button'
import Logo from '@/components/logo'

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
        id,
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
  const hostUserId = host?.id

  // Get host's display name from auth metadata
  let hostDisplayName = hostUsername
  if (hostUserId) {
    const { data: displayNameData } = await supabase.rpc('get_user_display_name', {
      p_user_id: hostUserId
    })
    if (displayNameData && typeof displayNameData === 'string') {
      hostDisplayName = displayNameData
    }
  }

  const startDate = new Date(meeting.start_time)
  const endDate = new Date(meeting.end_time)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full animate-fade-in">
        <div className="mb-8 flex justify-center">
          <Logo size="md" href="/" />
        </div>
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/50 p-10 text-center">
          <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-gradient-to-br from-green-100 via-green-50 to-green-100 mb-8 shadow-lg">
            <svg
              className="h-10 w-10 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h1 className="text-4xl font-serif font-bold text-navy-900 mb-4 tracking-tight">Booking Confirmed!</h1>
          <p className="text-gray-600 mb-10 text-lg">
            Your meeting has been successfully scheduled.
          </p>

          <div className="bg-gradient-to-br from-gray-50/80 to-navy-50/80 backdrop-blur-sm rounded-2xl p-8 mb-8 text-left border border-navy-100/50 shadow-lg">
            <h2 className="text-2xl font-serif font-bold text-navy-900 mb-6">{eventType.name}</h2>
            
            <div className="space-y-4 text-base">
              <div className="flex items-start py-3 border-b border-gray-200/50">
                <span className="font-bold text-navy-800 w-28">Date:</span>
                <span className="text-gray-900 font-semibold">
                  {startDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>

              <div className="flex items-start py-3 border-b border-gray-200/50">
                <span className="font-bold text-navy-800 w-28">Time:</span>
                <span className="text-gray-900 font-semibold">
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
                <div className="flex items-start py-3 border-b border-gray-200/50">
                  <span className="font-bold text-navy-800 w-28">Location:</span>
                  <span className="text-gray-900 font-semibold">{eventType.location}</span>
                </div>
              )}

              {eventType.location_type === 'video' && (
                <div className="flex items-start py-3">
                  <span className="font-bold text-navy-800 w-28">Type:</span>
                  <span className="text-gray-900 font-semibold">Video Call</span>
                </div>
              )}
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-6">
            A confirmation email has been sent to your email address with meeting details.
          </p>

          {/* Add to Calendar Section */}
          <div className="mb-8 bg-gradient-to-r from-navy-50/80 to-gray-50/80 backdrop-blur-sm rounded-xl p-6 border border-navy-100/50 shadow-sm">
            <p className="text-sm font-bold text-navy-900 mb-4">Add to Calendar:</p>
            <AddToCalendarButton
              meeting={{
                title: eventType.name,
                description: eventType.description || '',
                startTime: meeting.start_time,
                endTime: meeting.end_time,
                location: eventType.location || '',
                timezone: meeting.timezone || 'UTC',
              }}
            />
          </div>

          {/* Back to Scheduling Button */}
          {hostUsername && (
            <Link
              href={`/${hostUsername}`}
              className="block w-full px-6 py-4 bg-gradient-to-r from-gray-100 to-gray-50 text-navy-900 rounded-xl hover:from-gray-200 hover:to-gray-100 text-center transition-all font-bold border-2 border-gray-200/50 hover:border-navy-300/50 shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
            >
              Back to {hostDisplayName}&apos;s Scheduling Page
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}


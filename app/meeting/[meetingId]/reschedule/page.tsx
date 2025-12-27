import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import RescheduleMeeting from '@/components/meeting/reschedule-meeting'

interface PageProps {
  params: Promise<{
    meetingId: string
  }>
  searchParams: Promise<{
    token?: string
  }>
}

export default async function ReschedulePage({ params, searchParams }: PageProps) {
  const { meetingId } = await params
  const { token } = await searchParams

  const supabase = await createClient()

  // Fetch meeting details
  const { data: meeting, error } = await supabase
    .from('meetings')
    .select(`
      *,
      event_types:event_type_id (
        name,
        description,
        duration_minutes,
        location_type,
        location,
        buffer_before_minutes,
        buffer_after_minutes,
        minimum_notice_hours
      )
    `)
    .eq('id', meetingId)
    .in('status', ['confirmed', 'pending'])
    .single()

  if (error || !meeting) {
    notFound()
  }

  const eventType = Array.isArray(meeting.event_types)
    ? meeting.event_types[0]
    : meeting.event_types

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Reschedule Meeting</h1>
          <p className="text-gray-600 mb-6">{eventType.name}</p>

          <RescheduleMeeting
            meetingId={meetingId}
            currentStartTime={meeting.start_time}
            currentEndTime={meeting.end_time}
            eventTypeId={meeting.event_type_id}
            hostUserId={meeting.host_user_id}
            hostTimezone={meeting.timezone}
            durationMinutes={eventType.duration_minutes}
            minimumNoticeHours={eventType.minimum_notice_hours}
            token={token}
          />
        </div>
      </div>
    </div>
  )
}


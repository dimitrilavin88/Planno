import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import CancelMeeting from '@/components/meeting/cancel-meeting'

interface PageProps {
  params: Promise<{
    meetingId: string
  }>
  searchParams: Promise<{
    token?: string
  }>
}

export default async function CancelPage({ params, searchParams }: PageProps) {
  const { meetingId } = await params
  const { token } = await searchParams

  const supabase = await createClient()

  // Fetch meeting details
  const { data: meeting, error } = await supabase
    .from('meetings')
    .select(`
      *,
      event_types:event_type_id (
        name
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
      <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <CancelMeeting
            meetingId={meetingId}
            meetingTitle={eventType.name}
            startTime={meeting.start_time}
            token={token}
          />
        </div>
      </div>
    </div>
  )
}


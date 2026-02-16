import { requireAuth } from '@/lib/auth/utils'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import CancelMeeting from '@/components/meeting/cancel-meeting'

interface PageProps {
  params: Promise<{
    meetingId: string
  }>
  searchParams: Promise<{
    token?: string
    returnTo?: string
  }>
}

export default async function CancelPage({ params, searchParams }: PageProps) {
  await requireAuth()
  const { meetingId } = await params
  const { token, returnTo } = await searchParams

  const supabase = await createClient()

  // Fetch meeting via RPC (bypasses RLS; verifies user has access)
  const { data: meeting, error } = await supabase.rpc('get_meeting_for_cancel', {
    p_meeting_id: meetingId,
  })

  if (error || !meeting) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <CancelMeeting
            meetingId={meeting.id}
            meetingTitle={meeting.title}
            startTime={meeting.start_time}
            recurringScheduleId={meeting.recurring_schedule_id}
            token={token}
            returnTo={returnTo}
          />
        </div>
      </div>
    </div>
  )
}


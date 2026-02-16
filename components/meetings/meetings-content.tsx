'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import MeetingsList from '@/components/meetings/meetings-list'
import CreateMeetingModal from '@/components/meetings/create-meeting-modal'

interface Meeting {
  id: string
  [key: string]: unknown
}

interface EventTypeOption {
  id: string
  name: string
  duration_minutes: number
}

interface Props {
  upcomingMeetings: Meeting[]
  pastMeetings: Meeting[]
  userTimezone: string
  eventTypes: EventTypeOption[]
  groupEventTypes: EventTypeOption[]
}

export default function MeetingsContent({
  upcomingMeetings,
  pastMeetings,
  userTimezone,
  eventTypes,
  groupEventTypes,
}: Props) {
  const router = useRouter()
  const [showCreateModal, setShowCreateModal] = useState(false)

  const canCreateMeeting = eventTypes.length > 0 || groupEventTypes.length > 0

  return (
    <>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-navy-900">Meetings</h1>
          <p className="mt-2 text-gray-600">Manage your upcoming and past meetings</p>
        </div>
        <div className="flex gap-3">
          {canCreateMeeting && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="min-h-[44px] flex items-center justify-center w-fit px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Create meeting
            </button>
          )}
          <Link
            href="/dashboard"
            className="min-h-[44px] flex items-center justify-center w-fit px-4 py-2.5 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors font-medium"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      <MeetingsList
        upcomingMeetings={upcomingMeetings}
        pastMeetings={pastMeetings}
        userTimezone={userTimezone}
        eventTypes={eventTypes}
        groupEventTypes={groupEventTypes}
      />

      <CreateMeetingModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        eventTypes={eventTypes}
        groupEventTypes={groupEventTypes}
        userTimezone={userTimezone}
        onSuccess={() => router.refresh()}
      />
    </>
  )
}

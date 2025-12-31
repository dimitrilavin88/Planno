'use client'

import { useState } from 'react'
import Link from 'next/link'
import DownloadICSButton from '@/components/calendar/download-ics-button'

interface Meeting {
  id: string
  start_time: string
  end_time: string
  status: string
  event_types: {
    name: string
    location_type: string
    location?: string
  } | Array<{
    name: string
    location_type: string
    location?: string
  }>
  participants: Array<{
    name: string
    email: string
    is_host: boolean
  }>
}

interface Props {
  upcomingMeetings: Meeting[]
  pastMeetings: Meeting[]
  userTimezone?: string
  isSharedDashboard?: boolean
  canEdit?: boolean
  ownerId?: string
}

export default function MeetingsList({ upcomingMeetings, pastMeetings, userTimezone = 'UTC', isSharedDashboard = false, canEdit = true, ownerId }: Props) {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: userTimezone,
    }
    const dateOptions: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      timeZone: userTimezone,
    }
    const datetimeOptions: Intl.DateTimeFormatOptions = {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      timeZone: userTimezone,
    }
    return {
      date: date.toLocaleDateString('en-US', dateOptions),
      time: date.toLocaleTimeString('en-US', timeOptions),
      datetime: date.toLocaleString('en-US', datetimeOptions),
    }
  }

  const getEventType = (meeting: Meeting) => {
    return Array.isArray(meeting.event_types) ? meeting.event_types[0] : meeting.event_types
  }

  const getGuestParticipants = (meeting: Meeting) => {
    if (!meeting.participants || !Array.isArray(meeting.participants)) {
      return []
    }
    return meeting.participants.filter((p) => !p.is_host)
  }

  const getAllParticipants = (meeting: Meeting) => {
    if (!meeting.participants || !Array.isArray(meeting.participants)) {
      return []
    }
    return meeting.participants
  }

  const getMeetingTitle = (meeting: Meeting) => {
    const eventType = getEventType(meeting)
    if (eventType && eventType.name) {
      return eventType.name
    }
    // Fallback to meeting title if event type is not available (e.g., group meetings)
    return (meeting as any).title || 'Meeting'
  }

  const meetings = activeTab === 'upcoming' ? upcomingMeetings : pastMeetings
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="bg-white shadow rounded-lg">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`py-4 px-6 text-sm font-medium ${
              activeTab === 'upcoming'
                ? 'border-b-2 border-navy-700 text-navy-900'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Upcoming ({upcomingMeetings.length})
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`py-4 px-6 text-sm font-medium ${
              activeTab === 'past'
                ? 'border-b-2 border-navy-700 text-navy-900'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Past ({pastMeetings.length})
          </button>
        </nav>
      </div>

      {/* Meetings List */}
      <div className="divide-y divide-gray-200">
        {meetings.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No {activeTab} meetings
          </div>
        ) : (
          meetings.map((meeting) => {
            const eventType = getEventType(meeting)
            const guests = getGuestParticipants(meeting)
            const allParticipants = getAllParticipants(meeting)
            const meetingTitle = getMeetingTitle(meeting)
            const { date, time, datetime } = formatDateTime(meeting.start_time)

            return (
              <div key={meeting.id} className="p-6 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {meetingTitle}
                      </h3>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          meeting.status === 'confirmed'
                            ? 'bg-green-100 text-green-800'
                            : meeting.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {meeting.status}
                      </span>
                    </div>

                    <div className="space-y-1 text-sm text-gray-600">
                      <p>
                        <span className="font-medium">Date:</span> {date}
                      </p>
                      <p>
                        <span className="font-medium">Time:</span> {time}
                      </p>
                      {allParticipants.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <p className="font-medium text-gray-700 mb-1">Participants:</p>
                          <div className="space-y-1">
                            {allParticipants.map((participant, index) => (
                              <p key={participant.email || index} className="text-gray-600">
                                {participant.name}
                                {!participant.is_host && (
                                  <span className="text-gray-500 text-xs ml-2">({participant.email})</span>
                                )}
                        </p>
                            ))}
                          </div>
                        </div>
                      )}
                      {eventType?.location && (
                        <p className="mt-2">
                          <span className="font-medium">Location:</span> {eventType.location}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="ml-4 flex items-center space-x-2">
                    <DownloadICSButton meeting={meeting as any} />
                    {activeTab === 'upcoming' && canEdit && (
                      <>
                        <Link
                          href={`/meeting/${meeting.id}/reschedule${isSharedDashboard && ownerId ? `?returnTo=/dashboard/shared/${ownerId}/meetings` : ''}`}
                          className="px-3 py-1 text-sm bg-navy-900 text-white rounded hover:bg-navy-800 transition-colors"
                        >
                          Reschedule
                        </Link>
                        <Link
                          href={`/meeting/${meeting.id}/cancel${isSharedDashboard && ownerId ? `?returnTo=/dashboard/shared/${ownerId}/meetings` : ''}`}
                          className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Cancel
                        </Link>
                      </>
                    )}
                    {activeTab === 'upcoming' && isSharedDashboard && !canEdit && (
                      <span className="text-xs text-gray-500 italic">Read-only</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}


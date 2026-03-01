'use client'

import { useState } from 'react'
import Link from 'next/link'
import DownloadICSButton from '@/components/calendar/download-ics-button'

export interface Meeting {
  id: string
  event_type_id?: string | null
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
  }> | null
  participants: Array<{
    name: string
    email: string
    is_host: boolean
  }>
}

interface EventTypeOption {
  id: string
  name: string
  duration_minutes: number
}

interface Props {
  upcomingMeetings: Meeting[]
  pastMeetings: Meeting[]
  userTimezone?: string
  isSharedDashboard?: boolean
  canEdit?: boolean
  ownerId?: string
  eventTypes?: EventTypeOption[]
  groupEventTypes?: EventTypeOption[]
}

export default function MeetingsList({ upcomingMeetings, pastMeetings, userTimezone = 'UTC', isSharedDashboard = false, canEdit = true, ownerId, eventTypes = [], groupEventTypes = [] }: Props) {
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

  const getParticipantsArray = (meeting: Meeting) => {
    const p = meeting.participants
    if (!p) return []
    return Array.isArray(p) ? p : [p]
  }

  const getGuestParticipants = (meeting: Meeting) => {
    return getParticipantsArray(meeting).filter((p) => p.is_host !== true)
  }

  const getAllParticipants = (meeting: Meeting) => {
    return getParticipantsArray(meeting)
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
  const eventTypeMeetings = meetings.filter((m) => (m as Meeting).event_type_id != null)
  const groupEventTypeMeetings = meetings.filter((m) => (m as Meeting).event_type_id == null)

  const renderMeetingCard = (meeting: Meeting) => {
    const eventType = getEventType(meeting)
    const allParticipants = getAllParticipants(meeting)
    const meetingTitle = getMeetingTitle(meeting)
    const { date, time } = formatDateTime(meeting.start_time)

    return (
      <div key={meeting.id} className="p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-2">
              <h3 className="text-base font-semibold text-gray-900 truncate">{meetingTitle}</h3>
              <span
                className={`shrink-0 px-2 py-0.5 text-xs rounded-full ${
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
            <p className="text-sm text-gray-600">{date}</p>
            <p className="text-sm text-gray-600">{time}</p>
            {allParticipants.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                {(meeting as Meeting).event_type_id != null ? (
                  <>
                    <p className="text-xs font-medium text-gray-700 mb-1">Meeting with:</p>
                    <div className="space-y-0.5">
                      {getGuestParticipants(meeting).map((participant, index) => (
                        <p key={participant.email || index} className="text-xs text-gray-600">
                          {participant.name}
                          {participant.email && (
                            <span className="text-gray-500 ml-1">({participant.email})</span>
                          )}
                        </p>
                      ))}
                      {getGuestParticipants(meeting).length === 0 && (
                        <p className="text-xs text-gray-500 italic">No guest listed</p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-medium text-gray-700 mb-1">Participants:</p>
                    <div className="space-y-0.5">
                      {allParticipants.map((participant, index) => (
                        <p key={participant.email || index} className="text-xs text-gray-600">
                          {participant.name}
                          {participant.email && (
                            <span className="text-gray-500 ml-1">({participant.email})</span>
                          )}
                        </p>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {eventType?.location && (
              <p className="mt-1 text-xs text-gray-500">
                <span className="font-medium">Location:</span> {eventType.location}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <DownloadICSButton meeting={meeting as any} />
            {activeTab === 'upcoming' && canEdit && (
              <>
                <Link
                  href={`/meeting/${meeting.id}/reschedule${isSharedDashboard && ownerId ? `?returnTo=/dashboard/shared/${ownerId}/meetings` : ''}`}
                  className="px-2 py-1 text-xs bg-navy-900 text-white rounded hover:bg-navy-800"
                >
                  Reschedule
                </Link>
                <Link
                  href={`/meeting/${meeting.id}/cancel${isSharedDashboard && ownerId ? `?returnTo=/dashboard/shared/${ownerId}/meetings` : ''}`}
                  className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
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
  }

  const renderSection = (title: string, sectionMeetings: Meeting[]) => (
    <div className="flex-1 min-w-0">
      <h3 className="px-4 py-3 text-sm font-semibold text-gray-900 bg-gray-50 border-b border-gray-200">
        {title} ({sectionMeetings.length})
      </h3>
      <div className="max-h-[500px] overflow-y-auto">
        {sectionMeetings.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">No meetings</div>
        ) : (
          sectionMeetings.map(renderMeetingCard)
        )}
      </div>
    </div>
  )

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

      {/* Meetings: Individual | Group */}
      <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-200">
        {renderSection('Individual Meetings', eventTypeMeetings)}
        {renderSection('Group Meetings', groupEventTypeMeetings)}
      </div>
    </div>
  )
}


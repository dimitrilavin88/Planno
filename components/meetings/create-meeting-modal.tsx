'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const DAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

const RECURRENCE_INTERVALS = [
  { value: 1, label: 'Weekly' },
  { value: 2, label: 'Every 2 weeks' },
]

interface EventTypeOption {
  id: string
  name: string
  duration_minutes: number
}

interface GroupEventTypeOption {
  id: string
  name: string
  duration_minutes: number
}

interface CreateMeetingModalProps {
  isOpen: boolean
  onClose: () => void
  eventTypes: EventTypeOption[]
  groupEventTypes: GroupEventTypeOption[]
  userTimezone?: string
  onSuccess?: () => void
}

export default function CreateMeetingModal({
  isOpen,
  onClose,
  eventTypes,
  groupEventTypes,
  userTimezone = 'UTC',
  onSuccess,
}: CreateMeetingModalProps) {
  const [typeKind, setTypeKind] = useState<'event' | 'group'>('event')
  const [eventTypeId, setEventTypeId] = useState('')
  const [groupEventTypeId, setGroupEventTypeId] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [isRecurring, setIsRecurring] = useState(false)
  const [intervalWeeks, setIntervalWeeks] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ created: number; failed?: number; message?: string } | null>(null)

  useEffect(() => {
    if (isOpen) {
      setError(null)
      setResult(null)
      setEventTypeId(eventTypes[0]?.id || '')
      setGroupEventTypeId(groupEventTypes[0]?.id || '')
      const today = new Date().toISOString().split('T')[0]
      setDate(today)
    }
  }, [isOpen, eventTypes, groupEventTypes])

  const selectedEventTypeId = typeKind === 'event' ? eventTypeId : null
  const selectedGroupEventTypeId = typeKind === 'group' ? groupEventTypeId : null
  const hasSelection = typeKind === 'event' ? !!eventTypeId : !!groupEventTypeId

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasSelection) {
      setError('Please select an event type')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    const supabase = createClient()

    if (isRecurring) {
      if (!date || !time) {
        setError('Please select start date and time for the recurring meeting')
        setLoading(false)
        return
      }
      const startDate = new Date(`${date}T${time}:00`)
      const dayOfWeek = startDate.getDay()
      const timeStr = time.length === 5 ? time : `${time}:00`.slice(0, 5)
      // Pass the user-selected start date so the series starts on that day, not "next occurrence of weekday"
      const firstOccurrenceDate = date

      const { data, error: rpcError } = await supabase.rpc('create_recurring_meetings', {
        p_day_of_week: dayOfWeek,
        p_start_time: timeStr,
        p_event_type_id: selectedEventTypeId || null,
        p_group_event_type_id: selectedGroupEventTypeId || null,
        p_weeks_ahead: 4,
        p_timezone: userTimezone,
        p_interval_weeks: intervalWeeks,
        p_first_occurrence_date: firstOccurrenceDate,
      })

      setLoading(false)

      if (rpcError) {
        setError(rpcError.message || 'Failed to create recurring meetings')
        return
      }

      const res = data as {
        success?: boolean
        error?: string
        created_count?: number
        failed_count?: number
        created?: Array<{ meeting_id?: string }>
      }
      if (!res?.success && res?.error) {
        setError(res.error)
        return
      }

      if (res?.created?.length) {
        res.created.forEach((item) => {
          if (item?.meeting_id) {
            fetch('/api/calendar/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ meetingId: item.meeting_id }),
            }).catch((err) => console.error('Calendar sync failed:', err))
          }
        })
      }
      setResult({
        created: res?.created_count ?? 0,
        failed: res?.failed_count ?? 0,
        message: 'Meetings created. Next month will be auto-created by the system.',
      })
      onSuccess?.()
    } else {
      if (!date || !time) {
        setError('Please select date and time')
        setLoading(false)
        return
      }

      const startDateTime = new Date(`${date}T${time}:00`)
      const startIso = startDateTime.toISOString()

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user?.email) {
        setError('User email not found')
        setLoading(false)
        return
      }

      if (typeKind === 'event') {
        const eventType = eventTypes.find((et) => et.id === eventTypeId)
        const { data: bookData, error: bookError } = await supabase.rpc('book_meeting', {
          p_event_type_id: eventTypeId,
          p_host_user_id: user.id,
          p_start_time: startIso,
          p_participant_name: 'Internal meeting',
          p_participant_email: user.email,
        })

        setLoading(false)

        if (bookError) {
          setError(bookError.message || 'Failed to create meeting')
          return
        }

        const res = bookData as { success?: boolean; error?: string; meeting_id?: string }
        if (!res?.success && res?.error) {
          setError(res.error)
          return
        }

        if (res?.meeting_id) {
          fetch('/api/calendar/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ meetingId: res.meeting_id }),
          }).catch((err) => console.error('Calendar sync failed:', err))
        }
        setResult({ created: 1 })
        onSuccess?.()
      } else {
        const { data: bookData, error: bookError } = await supabase.rpc('book_group_meeting', {
          p_group_event_type_id: groupEventTypeId,
          p_start_time: startIso,
          p_participant_name: 'Internal meeting',
          p_participant_email: user.email,
        })

        setLoading(false)

        if (bookError) {
          setError(bookError.message || 'Failed to create meeting')
          return
        }

        const res = bookData as { success?: boolean; error?: string; meeting_id?: string }
        if (!res?.success && res?.error) {
          setError(res.error)
          return
        }

        if (res?.meeting_id) {
          fetch('/api/calendar/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ meetingId: res.meeting_id }),
          }).catch((err) => console.error('Calendar sync failed:', err))
        }
        setResult({ created: 1 })
        onSuccess?.()
      }
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} aria-hidden="true" />
        <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>

        <div className="relative inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Create meeting</h3>
          <p className="text-sm text-gray-600 mb-4">
            Choose an event type, pick a date and time, and optionally make it recurring.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Event type</label>
              <div className="mt-1 flex gap-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    checked={typeKind === 'event'}
                    onChange={() => setTypeKind('event')}
                    className="text-navy-600 focus:ring-navy-500"
                  />
                  <span className="ml-2">Event type</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    checked={typeKind === 'group'}
                    onChange={() => setTypeKind('group')}
                    className="text-navy-600 focus:ring-navy-500"
                  />
                  <span className="ml-2">Group event type</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                {typeKind === 'event' ? 'Event type' : 'Group event type'}
              </label>
              <select
                value={typeKind === 'event' ? eventTypeId : groupEventTypeId}
                onChange={(e) =>
                  typeKind === 'event' ? setEventTypeId(e.target.value) : setGroupEventTypeId(e.target.value)
                }
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-navy-500 focus:border-navy-700"
              >
                <option value="">Select...</option>
                {typeKind === 'event'
                  ? eventTypes.map((et) => (
                      <option key={et.id} value={et.id}>
                        {et.name} ({et.duration_minutes} min)
                      </option>
                    ))
                  : groupEventTypes.map((get) => (
                      <option key={get.id} value={get.id}>
                        {get.name} ({get.duration_minutes} min)
                      </option>
                    ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-navy-500 focus:border-navy-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Time</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-navy-500 focus:border-navy-700"
                />
                <p className="mt-1 text-xs text-gray-500">Timezone: {userTimezone}</p>
              </div>
            </div>

            <div>
              <label className="inline-flex items-center">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="rounded border-gray-300 text-navy-600 focus:ring-navy-500"
                />
                <span className="ml-2 text-sm font-medium text-gray-700">Recurring meeting</span>
              </label>
              {isRecurring && (
                <div className="mt-2 ml-6">
                  <select
                    value={intervalWeeks}
                    onChange={(e) => setIntervalWeeks(parseInt(e.target.value))}
                    className="block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-navy-500 focus:border-navy-700 text-sm"
                  >
                    {RECURRENCE_INTERVALS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Creates 4 occurrences (1 month). Next month auto-created by the system.
                  </p>
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {result && (
              <div className="rounded-md bg-green-50 p-3">
                <p className="text-sm font-medium text-gray-900">
                  Created {result.created} meeting{result.created !== 1 ? 's' : ''}
                  {result.failed ? ` (${result.failed} failed due to conflicts)` : ''}.
                </p>
                {result.message && <p className="mt-1 text-xs text-gray-600">{result.message}</p>}
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                {result ? 'Close' : 'Cancel'}
              </button>
              {!result && (
                <button
                  type="submit"
                  disabled={loading || !hasSelection}
                  className="px-4 py-2 bg-navy-900 text-white rounded-md hover:bg-navy-800 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create meeting'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

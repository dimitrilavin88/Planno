'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface RescheduleMeetingProps {
  meetingId: string
  currentStartTime: string
  currentEndTime: string
  eventTypeId: string
  hostUserId: string
  hostTimezone: string
  durationMinutes: number
  minimumNoticeHours: number
  token?: string
}

export default function RescheduleMeeting({
  meetingId,
  currentStartTime,
  currentEndTime,
  eventTypeId,
  hostUserId,
  hostTimezone,
  durationMinutes,
  minimumNoticeHours,
  token,
}: RescheduleMeetingProps) {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [timeSlots, setTimeSlots] = useState<any[]>([])
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [rescheduling, setRescheduling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [timezone, setTimezone] = useState('UTC')

  useEffect(() => {
    try {
      const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone
      setTimezone(detectedTz)
    } catch (e) {
      // Ignore
    }

    // Set initial date to current meeting date
    const currentDate = new Date(currentStartTime)
    setSelectedDate(currentDate.toISOString().split('T')[0])
  }, [currentStartTime])

  const loadTimeSlots = useCallback(async () => {
    if (!selectedDate) return

    setLoading(true)
    setError(null)
    setSelectedSlot(null)

    const supabase = createClient()
    const startDate = selectedDate
    const endDate = new Date(selectedDate)
    endDate.setDate(endDate.getDate() + 13)

    try {
      const { data, error: rpcError } = await supabase.rpc('calculate_availability', {
        p_event_type_id: eventTypeId,
        p_start_date: startDate,
        p_end_date: endDate.toISOString().split('T')[0],
        p_timezone: timezone,
      })

      if (rpcError) throw rpcError

      // Filter slots for selected date, excluding current meeting time
      const slotsForDate = (data || []).filter((slot: any) => {
        const slotDate = new Date(slot.slot_start_local).toISOString().split('T')[0]
        const slotStart = new Date(slot.slot_start)
        const currentStart = new Date(currentStartTime)
        return slotDate === selectedDate && slotStart.getTime() !== currentStart.getTime()
      })

      setTimeSlots(slotsForDate)
    } catch (err: any) {
      setError(err.message || 'Failed to load available times')
    } finally {
      setLoading(false)
    }
  }, [selectedDate, timezone, eventTypeId, currentStartTime])

  useEffect(() => {
    if (selectedDate) {
      loadTimeSlots()
  }
  }, [selectedDate, loadTimeSlots])

  const handleReschedule = async () => {
    if (!selectedSlot) return

    setRescheduling(true)
    setError(null)

    const supabase = createClient()

    try {
      const { data, error: rescheduleError } = await supabase.rpc('reschedule_meeting', {
        p_meeting_id: meetingId,
        p_new_start_time: selectedSlot.slot_start,
        p_participant_token: token || null,
      })

      if (rescheduleError || !data || !data.success) {
        throw new Error(data?.error || rescheduleError?.message || 'Rescheduling failed')
      }

      // Update calendar event (fire and forget)
      if (selectedSlot) {
        fetch('/api/calendar/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            meetingId,
            newStartTime: selectedSlot.slot_start,
            newEndTime: selectedSlot.slot_end,
          }),
        }).catch((err) => {
          console.error('Calendar update failed:', err)
        })
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/dashboard/meetings')
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to reschedule meeting')
      setRescheduling(false)
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    })
  }

  const formatCurrentTime = () => {
    const start = new Date(currentStartTime)
    const end = new Date(currentEndTime)
    return `${start.toLocaleString('en-US', { timeZone: timezone })} - ${formatTime(currentEndTime)}`
  }

  if (success) {
    return (
      <div className="text-center py-8">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Meeting Rescheduled!</h2>
        <p className="text-gray-600">Redirecting to your meetings...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 rounded-md p-4">
        <p className="text-sm font-medium text-gray-700 mb-1">Current Meeting Time</p>
        <p className="text-lg text-gray-900">{formatCurrentTime()}</p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Select New Date</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-navy-500 focus:border-navy-700"
        />
      </div>

      {loading && <div className="text-center py-8 text-gray-500">Loading available times...</div>}

      {!loading && timeSlots.length === 0 && selectedDate && (
        <div className="text-center py-8 text-gray-500">
          No available times for this date. Please select another date.
        </div>
      )}

      {!loading && timeSlots.length > 0 && !selectedSlot && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Select New Time
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {timeSlots.map((slot, index) => (
              <button
                key={index}
                onClick={() => setSelectedSlot(slot)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:border-navy-700 hover:bg-navy-50 text-sm font-medium transition-colors"
              >
                {formatTime(slot.slot_start_local)}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedSlot && (
        <div className="border-t pt-6">
          <div className="bg-navy-50 rounded-md p-4 mb-4 border border-navy-200">
            <p className="text-sm font-medium text-navy-900">New Meeting Time</p>
            <p className="text-lg font-semibold text-navy-900">
              {new Date(selectedDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
              {' at '}
              {formatTime(selectedSlot.slot_start_local)}
            </p>
          </div>

          <div className="flex justify-end space-x-4">
            <button
              onClick={() => {
                setSelectedSlot(null)
                setError(null)
              }}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Change Time
            </button>
            <button
              onClick={handleReschedule}
              disabled={rescheduling}
              className="px-6 py-2 bg-navy-900 text-white rounded-md hover:bg-navy-800 disabled:opacity-50 transition-colors"
            >
              {rescheduling ? 'Rescheduling...' : 'Confirm Reschedule'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}


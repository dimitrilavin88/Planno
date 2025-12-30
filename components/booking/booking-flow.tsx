'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface BookingFlowProps {
  eventTypeId: string
  hostUserId: string
  hostTimezone: string
  durationMinutes: number
  locationType: string
  location?: string
}

interface TimeSlot {
  slot_start: string
  slot_end: string
  slot_start_local: string
  slot_end_local: string
}

export default function BookingFlow({
  eventTypeId,
  hostUserId,
  hostTimezone,
  durationMinutes,
  locationType,
  location,
}: BookingFlowProps) {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [loading, setLoading] = useState(false)
  const [booking, setBooking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form fields
  const [participantName, setParticipantName] = useState('')
  const [participantEmail, setParticipantEmail] = useState('')
  const [participantNotes, setParticipantNotes] = useState('')
  const [timezone, setTimezone] = useState('UTC')

  // Detect user timezone
  useEffect(() => {
    try {
      const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone
      setTimezone(detectedTz)
    } catch (e) {
      // Ignore
    }
  }, [])

  // Set initial date to tomorrow
  useEffect(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setSelectedDate(tomorrow.toISOString().split('T')[0])
  }, [])

  const loadTimeSlots = useCallback(async () => {
    if (!selectedDate) return

    setLoading(true)
    setError(null)
    setSelectedSlot(null)

    const supabase = createClient()
    const startDate = selectedDate
    const endDate = new Date(selectedDate)
    endDate.setDate(endDate.getDate() + 13) // Show 2 weeks of availability

    try {
      const { data, error: rpcError } = await supabase.rpc('calculate_availability', {
        p_event_type_id: eventTypeId,
        p_start_date: startDate,
        p_end_date: endDate.toISOString().split('T')[0],
        p_timezone: timezone,
      })

      if (rpcError) throw rpcError

      // Filter slots for selected date only
      const slotsForDate = (data || []).filter((slot: TimeSlot) => {
        const slotDate = new Date(slot.slot_start_local).toISOString().split('T')[0]
        return slotDate === selectedDate
      })

      setTimeSlots(slotsForDate)
    } catch (err: any) {
      setError(err.message || 'Failed to load available times')
    } finally {
      setLoading(false)
    }
  }, [selectedDate, timezone, eventTypeId])

  // Load time slots when date changes
  useEffect(() => {
    if (selectedDate) {
      loadTimeSlots()
    }
  }, [selectedDate, loadTimeSlots])

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSlot) return

    // Validate required fields
    const trimmedName = participantName.trim()
    const trimmedEmail = participantEmail.trim()
    
    if (!trimmedName) {
      setError('Please enter your name')
      return
    }
    
    if (!trimmedEmail) {
      setError('Please enter your email address')
      return
    }

    setBooking(true)
    setError(null)

    const supabase = createClient()

    // Generate lock ID
    const lockId = `lock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    try {
      // Lock the time slot first
      const { error: lockError } = await supabase.rpc('lock_time_slot', {
        p_user_id: hostUserId,
        p_event_type_id: eventTypeId,
        p_start_time: selectedSlot.slot_start,
        p_end_time: selectedSlot.slot_end,
        p_lock_id: lockId,
      })

      if (lockError) {
        // Lock might fail if slot was taken, but continue anyway
        console.warn('Lock failed:', lockError)
      }

      // Book the meeting - use trimmed name to ensure it's saved correctly
      const { data, error: bookError } = await supabase.rpc('book_meeting', {
        p_event_type_id: eventTypeId,
        p_host_user_id: hostUserId,
        p_start_time: selectedSlot.slot_start,
        p_participant_name: trimmedName, // Use trimmed name
        p_participant_email: trimmedEmail, // Use trimmed email
        p_participant_notes: participantNotes?.trim() || null,
        p_lock_id: lockId,
      })

      if (bookError || !data || !data.success) {
        throw new Error(data?.error || bookError?.message || 'Booking failed')
      }

      // Sync to calendar (fire and forget - don't block on this)
      fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId: data.meeting_id }),
      }).catch((err) => {
        console.error('Calendar sync failed:', err)
        // Don't throw - calendar sync failure shouldn't block booking
      })

      // Redirect to confirmation page
      router.push(`/booking/confirmed/${data.meeting_id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to book meeting')
      setBooking(false)
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

  const minDate = new Date()
  minDate.setDate(minDate.getDate() + 1)
  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + 60) // 60 days in advance

  return (
    <div className="space-y-6">
      {/* Date Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Date
        </label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          min={minDate.toISOString().split('T')[0]}
          max={maxDate.toISOString().split('T')[0]}
          className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-navy-500 focus:border-navy-700"
        />
      </div>

      {/* Time Slots */}
      {loading && (
        <div className="text-center py-8 text-gray-500">Loading available times...</div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {!loading && timeSlots.length === 0 && selectedDate && (
        <div className="text-center py-8 text-gray-500">
          No available times for this date. Please select another date.
        </div>
      )}

      {!loading && timeSlots.length > 0 && !selectedSlot && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Available Times
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

      {/* Booking Form */}
      {selectedSlot && (
        <form onSubmit={handleBooking} className="space-y-4 border-t pt-6">
          <div className="bg-navy-50 rounded-md p-4 mb-4 border border-navy-200">
            <p className="text-sm font-medium text-navy-900">Selected Time</p>
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
            {locationType === 'video' && (
              <p className="text-sm text-navy-700 mt-1">
                A video call link will be sent via email
              </p>
            )}
            {locationType === 'phone' && (
              <p className="text-sm text-navy-700 mt-1">
                Phone call details will be sent via email
              </p>
            )}
            {location && (
              <p className="text-sm text-navy-700 mt-1">Location: {location}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Name *
            </label>
            <input
              type="text"
              required
              value={participantName}
              onChange={(e) => setParticipantName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-navy-500 focus:border-navy-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              required
              value={participantEmail}
              onChange={(e) => setParticipantEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-navy-500 focus:border-navy-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Notes (optional)
            </label>
            <textarea
              value={participantNotes}
              onChange={(e) => setParticipantNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-navy-500 focus:border-navy-700"
              placeholder="Any additional information you'd like to share..."
            />
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={() => {
                setSelectedSlot(null)
                setError(null)
              }}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Change Time
            </button>
            <button
              type="submit"
              disabled={booking}
              className="px-6 py-2 bg-navy-900 text-white rounded-md hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {booking ? 'Booking...' : 'Confirm Booking'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}


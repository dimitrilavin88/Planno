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
  const [participantPhone, setParticipantPhone] = useState('')
  const [participantNotes, setParticipantNotes] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [timezone, setTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    } catch {
      return 'UTC'
    }
  })

  // Set initial date to today (same-day booking allowed)
  useEffect(() => {
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    setSelectedDate(`${y}-${m}-${d}`)
  }, [])

  const loadTimeSlots = useCallback(async () => {
    if (!selectedDate) return

    setLoading(true)
    setError(null)
    setSelectedSlot(null)

    const supabase = createClient()
    const startDate = selectedDate
    // Parse date in a timezone-safe way: YYYY-MM-DD + 13 days
    const [y, m, d] = selectedDate.split('-').map(Number)
    const endDateObj = new Date(y, m - 1, d + 13)
    const endDate = endDateObj.toISOString().split('T')[0]

    try {
      const { data, error: rpcError } = await supabase.rpc('calculate_availability', {
        p_event_type_id: eventTypeId,
        p_start_date: startDate,
        p_end_date: endDate,
        p_timezone: timezone,
      })

      if (rpcError) throw rpcError

      // Filter slots for selected date only (slot_start_local is in visitor's timezone - extract date directly to avoid timezone conversion bugs)
      const slotsForDate = (data || []).filter((slot: TimeSlot) => {
        const slotDate = String(slot.slot_start_local || '').slice(0, 10)
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
    const trimmedEmail = participantEmail.trim().toLowerCase()
    const rawPhone = participantPhone.trim()
    const digitsOnly = rawPhone.replace(/\D/g, '')

    let hasError = false
    setNameError(null)
    setEmailError(null)
    setPhoneError(null)

    if (!trimmedName) {
      setNameError('Please enter your name')
      hasError = true
    }

    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError('Please enter a valid email address')
      hasError = true
    }

    if (!rawPhone) {
      setPhoneError('Please enter your phone number')
      hasError = true
    }

    if (rawPhone && digitsOnly.length !== 10) {
      setPhoneError('Please enter a valid 10-digit phone number')
      hasError = true
    }

    if (hasError) {
      setError('Please fix the highlighted fields.')
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
        p_participant_name: trimmedName,
        p_participant_email: trimmedEmail || null,
        p_participant_phone: digitsOnly,
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

      // Send confirmation SMS right after booking (fire and forget)
      fetch('/api/booking/confirm-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId: data.meeting_id, phoneNumber: digitsOnly }),
      }).catch((err) => {
        console.error('Confirmation SMS failed:', err)
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

  // Format selectedDate (YYYY-MM-DD) as a calendar date in the visitor's local calendar
  const formatSelectedDate = (dateStr: string) => {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-').map(Number)
    const localDate = new Date(y, (m || 1) - 1, d || 1)
    return localDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + 60) // 60 days in advance

  const normalizedPhoneDigits = participantPhone.trim().replace(/\D/g, '')
  const isFormValid = participantName.trim().length > 0 && normalizedPhoneDigits.length === 10

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
          min={todayStr}
          max={maxDate.toISOString().split('T')[0]}
          className="w-full min-h-[48px] px-4 py-3 text-base border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-navy-500 focus:border-navy-700"
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
            {timeSlots.map((slot, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setSelectedSlot(slot)}
                className="min-h-[48px] px-4 py-3 border border-gray-300 rounded-lg hover:border-navy-700 hover:bg-navy-50 text-sm font-medium transition-colors active:bg-navy-100"
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
              {formatSelectedDate(selectedDate)}
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
              onChange={(e) => {
                setParticipantName(e.target.value)
                if (nameError) setNameError(null)
              }}
              className="w-full min-h-[48px] px-4 py-3 text-base border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-navy-500 focus:border-navy-700"
            />
            {nameError && (
              <p className="mt-1 text-sm text-red-600">
                {nameError}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email (optional)
            </label>
            <input
              type="email"
              value={participantEmail}
              onChange={(e) => {
                setParticipantEmail(e.target.value)
                if (emailError) setEmailError(null)
              }}
              className="w-full min-h-[48px] px-4 py-3 text-base border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-navy-500 focus:border-navy-700"
              placeholder="e.g. you@example.com"
            />
            {emailError && (
              <p className="mt-1 text-sm text-red-600">
                {emailError}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number *
            </label>
            <input
              type="tel"
              required
              value={participantPhone}
              onChange={(e) => {
                setParticipantPhone(e.target.value)
                if (phoneError) setPhoneError(null)
              }}
              className="w-full min-h-[48px] px-4 py-3 text-base border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-navy-500 focus:border-navy-700"
              placeholder="e.g. 555-123-4567"
            />
            {phoneError && (
              <p className="mt-1 text-sm text-red-600">
                {phoneError}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Notes (optional)
            </label>
            <textarea
              value={participantNotes}
              onChange={(e) => setParticipantNotes(e.target.value)}
              rows={3}
              className="w-full min-h-[80px] px-4 py-3 text-base border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-navy-500 focus:border-navy-700"
              placeholder="Any additional information you'd like to share..."
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end sm:space-x-4 pt-4">
            <button
              type="button"
              onClick={() => {
                setSelectedSlot(null)
                setError(null)
              }}
              className="min-h-[48px] px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
            >
              Change Time
            </button>
            <button
              type="submit"
              disabled={booking || !isFormValid}
              className="min-h-[48px] px-6 py-3 bg-navy-900 text-white rounded-lg hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {booking ? 'Booking...' : 'Confirm Booking'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}


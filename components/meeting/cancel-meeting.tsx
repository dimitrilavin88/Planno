'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

interface CancelMeetingProps {
  meetingId: string
  meetingTitle: string
  startTime: string
  recurringScheduleId?: string | null
  token?: string
  returnTo?: string
}

export default function CancelMeeting({
  meetingId,
  meetingTitle,
  startTime,
  recurringScheduleId,
  token,
  returnTo,
}: CancelMeetingProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelled, setCancelled] = useState(false)
  const isRecurring = !!recurringScheduleId

  const handleCancel = async (scope: 'single' | 'series') => {
    const confirmMsg = scope === 'series'
      ? 'Are you sure you want to cancel the entire recurring series? All future occurrences will be cancelled.'
      : 'Are you sure you want to cancel this meeting?'
    if (!confirm(confirmMsg)) return

    setCancelling(true)
    setError(null)

    const supabase = createClient()

    try {
      if (scope === 'series' && recurringScheduleId) {
        const { data, error: cancelError } = await supabase.rpc('cancel_recurring_series', {
          p_recurring_schedule_id: recurringScheduleId,
        })
        if (cancelError || !data?.success) {
          throw new Error(data?.error || cancelError?.message || 'Failed to cancel series')
        }
        // Calendar deletion for each meeting would require listing them - fire and forget for main meeting
        fetch('/api/calendar/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meetingId }),
        }).catch(() => {})
      } else {
        const { data, error: cancelError } = await supabase.rpc('cancel_meeting', {
          p_meeting_id: meetingId,
          p_participant_token: token || null,
        })
        if (cancelError || !data || !data.success) {
          throw new Error(data?.error || cancelError?.message || 'Cancellation failed')
        }
        fetch('/api/calendar/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meetingId }),
        }).catch((err) => {
          console.error('Calendar deletion failed:', err)
        })
      }

      setCancelled(true)
      const returnToParam = returnTo || searchParams?.get('returnTo')
      const redirectPath = returnToParam || '/dashboard/meetings'
      setTimeout(() => router.push(redirectPath), 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to cancel meeting')
      setCancelling(false)
    }
  }

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  if (cancelled) {
    return (
      <div className="text-center py-8">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Meeting Cancelled</h2>
        <p className="text-gray-600">The meeting has been cancelled. Redirecting...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Cancel Meeting</h1>
        <p className="text-gray-600">
          Are you sure you want to cancel this meeting? This action cannot be undone.
        </p>
      </div>

      <div className="bg-gray-50 rounded-md p-4">
        <p className="text-sm font-medium text-gray-700 mb-1">Meeting Details</p>
        <p className="text-lg font-semibold text-gray-900">{meetingTitle}</p>
        <p className="text-sm text-gray-600 mt-1">{formatDateTime(startTime)}</p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {isRecurring && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm font-medium text-amber-800">This is a recurring meeting.</p>
          <p className="text-sm text-amber-700 mt-1">
            Cancel only this occurrence, or cancel the entire series.
          </p>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        <button
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Go Back
        </button>
        {isRecurring ? (
          <>
            <button
              onClick={() => handleCancel('single')}
              disabled={cancelling}
              className="px-6 py-2 border border-red-600 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50"
            >
              {cancelling ? 'Cancelling...' : 'Cancel this occurrence'}
            </button>
            <button
              onClick={() => handleCancel('series')}
              disabled={cancelling}
              className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {cancelling ? 'Cancelling...' : 'Cancel entire series'}
            </button>
          </>
        ) : (
          <button
            onClick={() => handleCancel('single')}
            disabled={cancelling}
            className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {cancelling ? 'Cancelling...' : 'Cancel Meeting'}
          </button>
        )}
      </div>
    </div>
  )
}


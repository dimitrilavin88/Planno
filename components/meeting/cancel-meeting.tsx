'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface CancelMeetingProps {
  meetingId: string
  meetingTitle: string
  startTime: string
  token?: string
}

export default function CancelMeeting({
  meetingId,
  meetingTitle,
  startTime,
  token,
}: CancelMeetingProps) {
  const router = useRouter()
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelled, setCancelled] = useState(false)

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this meeting?')) {
      return
    }

    setCancelling(true)
    setError(null)

    const supabase = createClient()

    try {
      const { data, error: cancelError } = await supabase.rpc('cancel_meeting', {
        p_meeting_id: meetingId,
        p_participant_token: token || null,
      })

      if (cancelError || !data || !data.success) {
        throw new Error(data?.error || cancelError?.message || 'Cancellation failed')
      }

      setCancelled(true)
      setTimeout(() => {
        router.push('/dashboard/meetings')
      }, 2000)
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

      <div className="flex justify-end space-x-4">
        <button
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Go Back
        </button>
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
        >
          {cancelling ? 'Cancelling...' : 'Cancel Meeting'}
        </button>
      </div>
    </div>
  )
}


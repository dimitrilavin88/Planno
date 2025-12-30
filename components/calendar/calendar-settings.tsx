'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface Calendar {
  id: string
  provider: 'google' | 'outlook'
  calendar_id: string
  calendar_name: string | null
  is_primary: boolean
  is_active: boolean
  created_at: string
}

interface Props {
  initialCalendars: Calendar[]
}

export default function CalendarSettings({ initialCalendars }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [calendars, setCalendars] = useState<Calendar[]>(initialCalendars)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  // Refresh calendars when component mounts (after OAuth redirect)
  useEffect(() => {
    const success = searchParams.get('success')
    if (success === 'connected') {
      // Refresh the page to show updated calendars
      router.refresh()
    }
  }, [searchParams, router])

  const handleConnectGoogle = () => {
    window.location.href = '/api/calendar/google/connect'
  }

  const handleDisconnect = async (calendarId: string) => {
    if (!confirm('Are you sure you want to disconnect this calendar? Future meetings will not be synced.')) {
      return
    }

    setDisconnecting(calendarId)

    try {
      const response = await fetch('/api/calendar/google/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ calendarId }),
      })

      if (!response.ok) {
        throw new Error('Failed to disconnect calendar')
      }

      // Update local state
      setCalendars(calendars.map(cal => 
        cal.id === calendarId ? { ...cal, is_active: false } : cal
      ))

      router.refresh()
    } catch (error) {
      alert('Failed to disconnect calendar. Please try again.')
    } finally {
      setDisconnecting(null)
    }
  }

  const activeCalendars = calendars.filter(cal => cal.is_active)
  const inactiveCalendars = calendars.filter(cal => !cal.is_active)

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-xl font-serif font-semibold text-navy-900 mb-2">
          Connected Calendars
        </h2>
        <p className="text-sm text-gray-600">
          When you connect a calendar, all your meetings will be automatically synced.
        </p>
      </div>

      {/* Google Calendar Connection */}
      <div className="mb-6">
        <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Google Calendar</h3>
              <p className="text-sm text-gray-600">
                Sync meetings to your Google Calendar
              </p>
            </div>
          </div>
          {activeCalendars.some(cal => cal.provider === 'google') ? (
            <span className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded-full">
              Connected
            </span>
          ) : (
            <button
              onClick={handleConnectGoogle}
              className="px-4 py-2 bg-navy-900 text-white rounded-md hover:bg-navy-800 transition-colors"
            >
              Connect
            </button>
          )}
        </div>
      </div>

      {/* Active Calendars List */}
      {activeCalendars.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Active Connections</h3>
          <div className="space-y-2">
            {activeCalendars.map((calendar) => (
              <div
                key={calendar.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {calendar.calendar_name || `${calendar.provider} Calendar`}
                  </p>
                  <p className="text-sm text-gray-600">
                    {calendar.is_primary && 'Primary • '}
                    {calendar.provider === 'google' ? 'Google Calendar' : 'Outlook Calendar'}
                  </p>
                </div>
                <button
                  onClick={() => handleDisconnect(calendar.id)}
                  disabled={disconnecting === calendar.id}
                  className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                >
                  {disconnecting === calendar.id ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inactive Calendars */}
      {inactiveCalendars.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Disconnected Calendars</h3>
          <div className="space-y-2">
            {inactiveCalendars.map((calendar) => (
              <div
                key={calendar.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg opacity-60"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {calendar.calendar_name || `${calendar.provider} Calendar`}
                  </p>
                  <p className="text-sm text-gray-600">Disconnected</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Apple Calendar Info */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">Apple Calendar</h3>
        <p className="text-sm text-blue-800 mb-3">
          Apple Calendar doesn&apos;t support automatic sync. You can download .ics files for your meetings from the meetings page.
        </p>
        <Link
          href="/dashboard/meetings"
          className="text-sm text-blue-700 hover:text-blue-900 font-medium"
        >
          View Meetings →
        </Link>
      </div>
    </div>
  )
}


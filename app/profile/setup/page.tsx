'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ProfileSetupPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [timezone, setTimezone] = useState('UTC')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Common timezones
  const timezones = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Toronto',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney',
  ]

  useEffect(() => {
    // Try to detect user's timezone
    try {
      const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (timezones.includes(detectedTz)) {
        setTimezone(detectedTz)
      }
    } catch (e) {
      // Ignore errors
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Validate username
    if (!username.match(/^[a-zA-Z0-9_]{3,30}$/)) {
      setError('Username must be 3-30 characters and contain only letters, numbers, and underscores')
      setLoading(false)
      return
    }

    const supabase = createClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in')
      setLoading(false)
      return
    }

    // Call RPC function to update username
    const { data, error: rpcError } = await supabase.rpc('update_username', {
      p_user_id: user.id,
      p_username: username.toLowerCase(),
    })

    if (rpcError || !data || !data.success) {
      setError(data?.error || rpcError?.message || 'Failed to update username')
      setLoading(false)
      return
    }

    // Update timezone
    const { error: updateError } = await supabase
      .from('users')
      .update({ timezone })
      .eq('id', user.id)

    if (updateError) {
      setError('Failed to update timezone')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Complete your profile
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Set up your username and timezone to get started
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-navy-500 focus:border-navy-700 focus:z-10 sm:text-sm"
                placeholder="yourusername"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                pattern="[a-zA-Z0-9_]{3,30}"
              />
              <p className="mt-1 text-xs text-gray-500">
                3-30 characters, letters, numbers, and underscores only
              </p>
              <p className="mt-1 text-xs text-navy-700">
                Your scheduling page will be at: /{username || 'yourusername'}
              </p>
            </div>
            <div>
              <label htmlFor="timezone" className="block text-sm font-medium text-gray-700">
                Timezone
              </label>
              <select
                id="timezone"
                name="timezone"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-navy-500 focus:border-navy-700 sm:text-sm"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-navy-900 hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-navy-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Saving...' : 'Complete Setup'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

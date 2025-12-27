'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface AvailabilityRule {
  id?: string
  day_of_week: number
  start_time: string
  end_time: string
  is_available: boolean
}

interface Props {
  initialRules: AvailabilityRule[]
}

const DAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

export default function AvailabilityManager({ initialRules }: Props) {
  const router = useRouter()
  const [rules, setRules] = useState<AvailabilityRule[]>(initialRules || [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Sync with prop changes (e.g., after refresh)
  useEffect(() => {
    if (initialRules && initialRules.length >= 0) {
      setRules(initialRules)
    }
  }, [initialRules])

  const addRule = () => {
    setRules([
      ...rules,
      {
        day_of_week: 1, // Monday
        start_time: '09:00',
        end_time: '17:00',
        is_available: true,
      },
    ])
  }

  const updateRule = (index: number, field: keyof AvailabilityRule, value: any) => {
    const updated = [...rules]
    updated[index] = { ...updated[index], [field]: value }
    setRules(updated)
  }

  const deleteRule = async (index: number, ruleId?: string) => {
    if (ruleId) {
      // Delete from database
      const supabase = createClient()
      const { error } = await supabase
        .from('availability_rules')
        .delete()
        .eq('id', ruleId)

      if (error) {
        setError('Failed to delete availability rule')
        return
      }
    }

    // Remove from local state
    const updated = [...rules]
    updated.splice(index, 1)
    setRules(updated)
  }

  const saveRules = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

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

    try {
      // Validate rules
      for (const rule of rules) {
        if (rule.start_time >= rule.end_time) {
          setError('End time must be after start time')
          setLoading(false)
          return
        }
      }

      // Delete existing rules (we'll replace them all)
      // In production, you might want to update instead of delete/recreate
      const { error: deleteError } = await supabase
        .from('availability_rules')
        .delete()
        .eq('user_id', user.id)

      if (deleteError) {
        setError('Failed to update availability')
        setLoading(false)
        return
      }

      // Insert new rules
      if (rules.length > 0) {
        const rulesToInsert = rules.map((rule) => ({
          user_id: user.id,
          day_of_week: rule.day_of_week,
          start_time: rule.start_time,
          end_time: rule.end_time,
          is_available: rule.is_available,
        }))

        const { error: insertError } = await supabase
          .from('availability_rules')
          .insert(rulesToInsert)

        if (insertError) {
          setError('Failed to save availability')
          setLoading(false)
          return
        }
      }

      setSuccess('Availability saved successfully!')
      router.refresh()
    } catch (err) {
      setError('An error occurred while saving')
    } finally {
      setLoading(false)
    }
  }

  const groupedRules = DAYS.map((day) => ({
    ...day,
    rules: rules.filter((r) => r.day_of_week === day.value),
  }))

  // Format time for display (e.g., "09:00" -> "9:00 AM")
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours, 10)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-md bg-green-50 p-4">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      <div className="space-y-6">
        {groupedRules.map((day) => (
          <div key={day.value} className="border-b border-gray-200 pb-4 last:border-b-0">
            <h3 className="text-lg font-medium text-gray-900 mb-3">{day.label}</h3>
            {day.rules.length === 0 ? (
              <p className="text-sm text-gray-500">No availability set</p>
            ) : (
              <div className="space-y-3">
                {day.rules.map((rule) => {
                  const globalIndex = rules.findIndex((r) => {
                    if (r.id && rule.id) return r.id === rule.id
                    // For new rules without ID, match by all fields
                    return (
                      r.day_of_week === rule.day_of_week &&
                      r.start_time === rule.start_time &&
                      r.end_time === rule.end_time
                    )
                  })
                  return (
                    <div 
                      key={rule.id || `new-${day.value}-${rule.start_time}`} 
                      className="flex items-center space-x-4 p-3 bg-gray-50 rounded-md border border-gray-200"
                    >
                      <div className="flex-1 flex items-center space-x-3">
                      <input
                        type="time"
                        value={rule.start_time}
                        onChange={(e) => updateRule(globalIndex, 'start_time', e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
                      />
                      <span className="text-gray-500">to</span>
                      <input
                        type="time"
                        value={rule.end_time}
                        onChange={(e) => updateRule(globalIndex, 'end_time', e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
                      />
                        <span className="text-sm text-gray-600 ml-2">
                          ({formatTime(rule.start_time)} - {formatTime(rule.end_time)})
                        </span>
                      </div>
                      <button
                        onClick={() => deleteRule(globalIndex, rule.id)}
                        className="px-3 py-1 text-red-600 hover:text-red-800 hover:bg-red-50 text-sm font-medium rounded transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            <button
              onClick={() => {
                const newRule: AvailabilityRule = {
                  day_of_week: day.value,
                  start_time: '09:00',
                  end_time: '17:00',
                  is_available: true,
                }
                setRules([...rules, newRule])
              }}
              className="mt-2 text-sm text-navy-700 hover:text-navy-900 font-medium"
            >
              + Add time slot
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end space-x-4">
        <button
          onClick={saveRules}
          disabled={loading}
          className="px-4 py-2 bg-navy-900 text-white rounded-md hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Saving...' : 'Save Availability'}
        </button>
      </div>
    </div>
  )
}


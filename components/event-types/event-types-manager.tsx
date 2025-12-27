'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'

interface EventType {
  id?: string
  name: string
  description: string
  duration_minutes: number
  location_type: 'in_person' | 'phone' | 'video' | 'custom'
  location?: string
  buffer_before_minutes: number
  buffer_after_minutes: number
  minimum_notice_hours: number
  daily_limit?: number
  booking_link: string
  is_active: boolean
}

interface Props {
  initialEventTypes: EventType[]
}

export default function EventTypesManager({ initialEventTypes }: Props) {
  const router = useRouter()
  const [eventTypes, setEventTypes] = useState<EventType[]>(initialEventTypes)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateBookingLink = () => {
    return 'evt_' + uuidv4().replace(/-/g, '').substring(0, 24)
  }

  const newEventType: EventType = {
    name: '',
    description: '',
    duration_minutes: 30,
    location_type: 'video',
    location: '',
    buffer_before_minutes: 0,
    buffer_after_minutes: 0,
    minimum_notice_hours: 24,
    daily_limit: undefined,
    booking_link: generateBookingLink(),
    is_active: true,
  }

  const [formData, setFormData] = useState<EventType>(newEventType)

  const resetForm = () => {
    setFormData(newEventType)
    setEditingId(null)
    setShowForm(false)
    setError(null)
  }

  const handleEdit = (eventType: EventType) => {
    setFormData({ ...eventType })
    setEditingId(eventType.id || null)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in')
      setLoading(false)
      return
    }

    try {
      if (editingId) {
        // Update existing
        const { error: updateError } = await supabase
          .from('event_types')
          .update({
            name: formData.name,
            description: formData.description,
            duration_minutes: formData.duration_minutes,
            location_type: formData.location_type,
            location: formData.location || null,
            buffer_before_minutes: formData.buffer_before_minutes,
            buffer_after_minutes: formData.buffer_after_minutes,
            minimum_notice_hours: formData.minimum_notice_hours,
            daily_limit: formData.daily_limit || null,
            is_active: formData.is_active,
          })
          .eq('id', editingId)
          .eq('user_id', user.id)

        if (updateError) throw updateError
      } else {
        // Create new
        const { error: insertError } = await supabase
          .from('event_types')
          .insert({
            user_id: user.id,
            name: formData.name,
            description: formData.description,
            duration_minutes: formData.duration_minutes,
            location_type: formData.location_type,
            location: formData.location || null,
            buffer_before_minutes: formData.buffer_before_minutes,
            buffer_after_minutes: formData.buffer_after_minutes,
            minimum_notice_hours: formData.minimum_notice_hours,
            daily_limit: formData.daily_limit || null,
            booking_link: formData.booking_link,
            is_active: formData.is_active,
          })

        if (insertError) throw insertError
      }

      resetForm()
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to save event type')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event type?')) return

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { error } = await supabase
      .from('event_types')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      setError('Failed to delete event type')
      return
    }

    router.refresh()
  }

  const toggleActive = async (id: string, currentStatus: boolean) => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { error } = await supabase
      .from('event_types')
      .update({ is_active: !currentStatus })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      setError('Failed to update event type')
      return
    }

    router.refresh()
  }

  const baseUrl =
    typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL || ''

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Event Types List */}
      <div className="bg-white shadow rounded-lg divide-y divide-gray-200">
        {eventTypes.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No event types yet. Create your first one below.
          </div>
        ) : (
          eventTypes.map((eventType) => (
            <div key={eventType.id} className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-semibold text-gray-900">{eventType.name}</h3>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        eventType.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {eventType.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {eventType.description && (
                    <p className="mt-1 text-sm text-gray-600">{eventType.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
                    <span>Duration: {eventType.duration_minutes} min</span>
                    <span>Type: {eventType.location_type}</span>
                    {eventType.location && <span>Location: {eventType.location}</span>}
                    {eventType.buffer_before_minutes > 0 && (
                      <span>Buffer before: {eventType.buffer_before_minutes} min</span>
                    )}
                    {eventType.buffer_after_minutes > 0 && (
                      <span>Buffer after: {eventType.buffer_after_minutes} min</span>
                    )}
                    <span>Notice: {eventType.minimum_notice_hours} hours</span>
                    {eventType.daily_limit && <span>Daily limit: {eventType.daily_limit}</span>}
                  </div>
                  <div className="mt-2">
                    <p className="text-xs text-gray-500">Booking link:</p>
                    <code className="text-xs bg-gray-50 px-2 py-1 rounded">
                      {baseUrl}/book/{eventType.booking_link}
                    </code>
                  </div>
                </div>
                <div className="ml-4 flex space-x-2">
                  <button
                    onClick={() => toggleActive(eventType.id!, eventType.is_active)}
                    className={`px-3 py-1 text-sm rounded ${
                      eventType.is_active
                        ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {eventType.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleEdit(eventType)}
                    className="px-3 py-1 text-sm bg-navy-900 text-white rounded hover:bg-navy-800 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(eventType.id!)}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {editingId ? 'Edit Event Type' : 'Create Event Type'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-navy-500 focus:border-navy-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-navy-500 focus:border-navy-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Duration (minutes) *
                </label>
                <input
                  type="number"
                  required
                  min="5"
                  step="5"
                  value={formData.duration_minutes}
                  onChange={(e) =>
                    setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })
                  }
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-navy-500 focus:border-navy-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Location Type *</label>
                <select
                  value={formData.location_type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      location_type: e.target.value as EventType['location_type'],
                    })
                  }
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-navy-500 focus:border-navy-700"
                >
                  <option value="video">Video Call</option>
                  <option value="phone">Phone Call</option>
                  <option value="in_person">In Person</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>

            {formData.location_type !== 'video' && formData.location_type !== 'phone' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Location</label>
                <input
                  type="text"
                  value={formData.location || ''}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder={
                    formData.location_type === 'in_person'
                      ? 'Physical address'
                      : 'Custom location description'
                  }
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-navy-500 focus:border-navy-700"
                />
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Buffer Before (min)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.buffer_before_minutes}
                  onChange={(e) =>
                    setFormData({ ...formData, buffer_before_minutes: parseInt(e.target.value) })
                  }
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-navy-500 focus:border-navy-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Buffer After (min)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.buffer_after_minutes}
                  onChange={(e) =>
                    setFormData({ ...formData, buffer_after_minutes: parseInt(e.target.value) })
                  }
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-navy-500 focus:border-navy-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Min Notice (hours)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.minimum_notice_hours}
                  onChange={(e) =>
                    setFormData({ ...formData, minimum_notice_hours: parseInt(e.target.value) })
                  }
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-navy-500 focus:border-navy-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Daily Limit (optional)
              </label>
              <input
                type="number"
                min="1"
                value={formData.daily_limit || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    daily_limit: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                placeholder="No limit"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-navy-500 focus:border-navy-700"
              />
            </div>

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-navy-900 text-white rounded-md hover:bg-navy-800 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {!showForm && (
        <button
          onClick={() => {
            setFormData({ ...newEventType, booking_link: generateBookingLink() })
            setShowForm(true)
            setEditingId(null)
          }}
          className="w-full px-4 py-2 bg-navy-900 text-white rounded-md hover:bg-navy-800 transition-colors"
        >
          + Create Event Type
        </button>
      )}
    </div>
  )
}


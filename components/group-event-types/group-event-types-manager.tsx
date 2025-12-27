'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'

interface GroupEventType {
  id?: string
  name: string
  description: string
  duration_minutes: number
  location_type: 'in_person' | 'phone' | 'video' | 'custom'
  location?: string
  minimum_notice_hours: number
  booking_link: string
  is_active: boolean
  hosts?: Array<{
    user_id: string
    users: {
      id: string
      username: string
    }
  }>
}

interface Props {
  initialGroups: GroupEventType[]
  currentUserId: string
}

export default function GroupEventTypesManager({ initialGroups, currentUserId }: Props) {
  const router = useRouter()
  const [groups, setGroups] = useState<GroupEventType[]>(initialGroups)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hostUsernames, setHostUsernames] = useState<string[]>(['']) // Start with current user
  const [selectedHostIds, setSelectedHostIds] = useState<string[]>([currentUserId])

  const generateBookingLink = () => {
    return 'grp_' + uuidv4().replace(/-/g, '').substring(0, 24)
  }

  const newGroupEventType: GroupEventType = {
    name: '',
    description: '',
    duration_minutes: 30,
    location_type: 'video',
    location: '',
    minimum_notice_hours: 24,
    booking_link: generateBookingLink(),
    is_active: true,
  }

  const [formData, setFormData] = useState<GroupEventType>(newGroupEventType)

  const resetForm = () => {
    setFormData(newGroupEventType)
    setEditingId(null)
    setShowForm(false)
    setError(null)
    setHostUsernames([''])
    setSelectedHostIds([currentUserId])
  }

  const handleEdit = (group: GroupEventType) => {
    setFormData({ ...group })
    setEditingId(group.id || null)
    setShowForm(true)
    
    // Populate hosts
    if (group.hosts && Array.isArray(group.hosts)) {
      const usernames = group.hosts.map((h: any) => 
        h.users?.username || ''
      ).filter(Boolean)
      setHostUsernames(usernames.length > 0 ? usernames : [''])
      setSelectedHostIds(group.hosts.map((h: any) => h.user_id))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()

    try {
      // Validate hosts
      const validHostUsernames = hostUsernames.filter(Boolean)
      if (validHostUsernames.length < 2) {
        setError('Group events require at least 2 hosts')
        setLoading(false)
        return
      }

      // Look up user IDs for usernames
      const { data: users } = await supabase
        .from('users')
        .select('id, username')
        .in('username', validHostUsernames)

      if (!users || users.length !== validHostUsernames.length) {
        setError('One or more usernames not found')
        setLoading(false)
        return
      }

      const hostUserIds = users.map((u) => u.id)

      if (editingId) {
        // Update existing group
        const { error: updateError } = await supabase
          .from('group_event_types')
          .update({
            name: formData.name,
            description: formData.description,
            duration_minutes: formData.duration_minutes,
            location_type: formData.location_type,
            location: formData.location || null,
            minimum_notice_hours: formData.minimum_notice_hours,
            is_active: formData.is_active,
          })
          .eq('id', editingId)

        if (updateError) throw updateError

        // Update hosts (delete and recreate)
        await supabase.from('group_event_type_hosts').delete().eq('group_event_type_id', editingId)
        
        const hostInserts = hostUserIds.map((userId) => ({
          group_event_type_id: editingId,
          user_id: userId,
        }))
        await supabase.from('group_event_type_hosts').insert(hostInserts)
      } else {
        // Create new group
        const { data: newGroup, error: insertError } = await supabase
          .from('group_event_types')
          .insert({
            name: formData.name,
            description: formData.description,
            duration_minutes: formData.duration_minutes,
            location_type: formData.location_type,
            location: formData.location || null,
            minimum_notice_hours: formData.minimum_notice_hours,
            booking_link: formData.booking_link,
            is_active: formData.is_active,
          })
          .select()
          .single()

        if (insertError) throw insertError

        // Create host relationships
        const hostInserts = hostUserIds.map((userId) => ({
          group_event_type_id: newGroup.id,
          user_id: userId,
        }))
        await supabase.from('group_event_type_hosts').insert(hostInserts)
      }

      resetForm()
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to save group event type')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this group event type?')) return

    const supabase = createClient()
    const { error } = await supabase.from('group_event_types').delete().eq('id', id)

    if (error) {
      setError('Failed to delete group event type')
      return
    }

    router.refresh()
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Groups List */}
      <div className="bg-white shadow rounded-lg divide-y divide-gray-200">
        {groups.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No group event types yet. Create your first one below.
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.id} className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{group.name}</h3>
                  {group.description && (
                    <p className="mt-1 text-sm text-gray-600">{group.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
                    <span>Duration: {group.duration_minutes} min</span>
                    <span>Type: {group.location_type}</span>
                    {group.location && <span>Location: {group.location}</span>}
                    <span>Notice: {group.minimum_notice_hours} hours</span>
                  </div>
                  {group.hosts && Array.isArray(group.hosts) && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-700">Hosts:</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {group.hosts.map((host: any, idx: number) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                          >
                            {host.users?.username || 'Unknown'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mt-2">
                    <p className="text-xs text-gray-500">Booking link:</p>
                    <code className="text-xs bg-gray-50 px-2 py-1 rounded">
                      {baseUrl}/book-group/{group.booking_link}
                    </code>
                  </div>
                </div>
                <div className="ml-4 flex space-x-2">
                  <button
                    onClick={() => handleEdit(group)}
                    className="px-3 py-1 text-sm bg-navy-900 text-white rounded hover:bg-navy-800 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(group.id!)}
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
            {editingId ? 'Edit Group Event Type' : 'Create Group Event Type'}
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
                      location_type: e.target.value as GroupEventType['location_type'],
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
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-navy-500 focus:border-navy-700"
                />
              </div>
            )}

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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hosts (usernames) * - At least 2 required
              </label>
              {hostUsernames.map((username, index) => (
                <div key={index} className="flex space-x-2 mb-2">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                      const newUsernames = [...hostUsernames]
                      newUsernames[index] = e.target.value.toLowerCase()
                      setHostUsernames(newUsernames)
                    }}
                    placeholder="username"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {hostUsernames.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setHostUsernames(hostUsernames.filter((_, i) => i !== index))
                      }}
                      className="px-3 py-2 text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setHostUsernames([...hostUsernames, ''])}
                className="text-sm text-navy-700 hover:text-navy-900"
              >
                + Add Host
              </button>
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
            setFormData({ ...newGroupEventType, booking_link: generateBookingLink() })
            setShowForm(true)
            setEditingId(null)
            setHostUsernames([''])
          }}
          className="w-full px-4 py-2 bg-navy-900 text-white rounded-md hover:bg-navy-800 transition-colors"
        >
          + Create Group Event Type
        </button>
      )}
    </div>
  )
}


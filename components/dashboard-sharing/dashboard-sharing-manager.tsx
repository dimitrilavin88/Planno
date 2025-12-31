'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Share {
  id: string
  owner_user_id: string
  shared_with_user_id: string
  permission_level: 'view' | 'edit'
  created_at: string
  shared_with_user?: {
    id: string
    username: string
    email?: string
    display_name?: string
  }
}

interface SharedWithMe {
  id: string
  owner_user_id: string
  shared_with_user_id: string
  permission_level: 'view' | 'edit'
  created_at: string
  owner?: {
    id: string
    username: string
    display_name?: string
  }
}

interface DashboardSharingManagerProps {
  initialShares: Share[]
  sharedWithMe: SharedWithMe[]
}

export default function DashboardSharingManager({ 
  initialShares, 
  sharedWithMe 
}: DashboardSharingManagerProps) {
  const router = useRouter()
  const supabase = createClient()
  const [shares, setShares] = useState<Share[]>(initialShares)
  const [email, setEmail] = useState('')
  const [permissionLevel, setPermissionLevel] = useState<'view' | 'edit'>('view')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Sync with prop changes (e.g., after refresh)
  useEffect(() => {
    if (initialShares) {
      setShares(initialShares)
    }
  }, [initialShares])

  const handleGrantAccess = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('You must be logged in')
        setLoading(false)
        return
      }

      // Call the RPC function
      const { data, error: rpcError } = await supabase.rpc('grant_dashboard_access', {
        p_owner_user_id: user.id,
        p_shared_email: email.trim(),
        p_permission_level: permissionLevel
      })

      if (rpcError) {
        setError(rpcError.message || 'Failed to grant access')
        setLoading(false)
        return
      }

      if (data && !data.success) {
        setError(data.error || 'Failed to grant access')
        setLoading(false)
        return
      }

      setSuccess('Access granted successfully!')
      setEmail('')
      setPermissionLevel('view')
      
      // Refresh the page to show updated shares
      router.refresh()
    } catch (err) {
      setError('An unexpected error occurred')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleRevokeAccess = async (shareId: string, sharedUserId: string) => {
    if (!confirm('Are you sure you want to revoke access?')) {
      return
    }

    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('You must be logged in')
        setLoading(false)
        return
      }

      const { data, error: rpcError } = await supabase.rpc('revoke_dashboard_access', {
        p_owner_user_id: user.id,
        p_shared_user_id: sharedUserId
      })

      if (rpcError) {
        setError(rpcError.message || 'Failed to revoke access')
        setLoading(false)
        return
      }

      if (data && !data.success) {
        setError(data.error || 'Failed to revoke access')
        setLoading(false)
        return
      }

      setSuccess('Access revoked successfully!')
      
      // Remove from local state
      setShares(shares.filter(s => s.id !== shareId))
      
      // Refresh the page
      router.refresh()
    } catch (err) {
      setError('An unexpected error occurred')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Grant Access Form */}
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-8">
        <h2 className="text-2xl font-serif font-bold text-navy-900 mb-6">
          Grant Access
        </h2>
        
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-4">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        <form onSubmit={handleGrantAccess} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2.5">
              User Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-5 py-3.5 border-2 border-gray-200 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500/50 focus:border-navy-500 transition-all sm:text-sm shadow-sm hover:shadow-md"
              placeholder="user@example.com"
            />
            <p className="mt-2 text-xs text-gray-500">
              Enter the email address of the user you want to grant access to
            </p>
          </div>

          <div>
            <label htmlFor="permission" className="block text-sm font-semibold text-gray-700 mb-2.5">
              Permission Level
            </label>
            <select
              id="permission"
              value={permissionLevel}
              onChange={(e) => setPermissionLevel(e.target.value as 'view' | 'edit')}
              className="w-full px-5 py-3.5 border-2 border-gray-200 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500/50 focus:border-navy-500 transition-all sm:text-sm shadow-sm hover:shadow-md"
            >
              <option value="view">View Only - Can see dashboard but cannot make changes</option>
              <option value="edit">Edit - Can view and modify dashboard settings</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3.5 bg-gradient-to-r from-navy-900 to-navy-800 text-white rounded-xl hover:from-navy-800 hover:to-navy-700 font-semibold transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Granting Access...' : 'Grant Access'}
          </button>
        </form>
      </div>

      {/* Current Shares List */}
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-8">
        <h2 className="text-2xl font-serif font-bold text-navy-900 mb-6">
          Shared With
        </h2>

        {shares.length === 0 ? (
          <p className="text-gray-600">No one has access to your dashboard yet.</p>
        ) : (
          <div className="space-y-4">
            {shares.map((share) => (
              <div
                key={share.id}
                className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-gray-50 to-white border border-gray-200/50 hover:shadow-md transition-all"
              >
                <div className="flex-1">
                  <p className="font-semibold text-navy-900">
                    {share.shared_with_user?.display_name || share.shared_with_user?.username || share.shared_with_user?.email || 'Unknown User'}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {share.shared_with_user?.email && share.shared_with_user?.email}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      share.permission_level === 'edit'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {share.permission_level === 'edit' ? 'Edit' : 'View Only'}
                    </span>
                    <span className="text-xs text-gray-500">
                      Since {new Date(share.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleRevokeAccess(share.id, share.shared_with_user_id)}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Shared With Me Section */}
      {sharedWithMe.length > 0 && (
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-8">
          <h2 className="text-2xl font-serif font-bold text-navy-900 mb-6">
            Dashboards Shared With Me
          </h2>
          <div className="space-y-4">
            {sharedWithMe.map((share) => (
              <div
                key={share.id}
                className="p-4 rounded-xl bg-gradient-to-r from-gray-50 to-white border border-gray-200/50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-navy-900">
                      {share.owner?.display_name || share.owner?.username || 'Unknown User'}&apos;s Dashboard
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        share.permission_level === 'edit'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {share.permission_level === 'edit' ? 'Edit Access' : 'View Only'}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/shared/${share.owner_user_id}`}
                    className="px-4 py-2 text-sm font-semibold text-navy-900 bg-navy-50 border border-navy-200 rounded-lg hover:bg-navy-100 transition-all"
                  >
                    {share.permission_level === 'edit' ? 'Edit Dashboard' : 'View Dashboard'}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


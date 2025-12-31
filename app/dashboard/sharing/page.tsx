import { requireAuth } from '@/lib/auth/utils'
import { createClient } from '@/lib/supabase/server'
import DashboardSharingManager from '@/components/dashboard-sharing/dashboard-sharing-manager'
import LogoutButton from '@/components/auth/logout-button'
import Logo from '@/components/logo'
import Link from 'next/link'

export default async function DashboardSharingPage() {
  const user = await requireAuth()
  const supabase = await createClient()

  // Fetch current shares where user is the owner
  const { data: shares } = await supabase
    .from('dashboard_shares')
    .select(`
      *,
      shared_with_user:shared_with_user_id (
        id,
        username
      )
    `)
    .eq('owner_user_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch emails for shared users
  const sharesWithEmails = await Promise.all(
    (shares || []).map(async (share) => {
      const { data: emailData } = await supabase.rpc('get_user_email', {
        p_user_id: share.shared_with_user_id
      })
      return {
        ...share,
        shared_with_user: {
          ...share.shared_with_user,
          email: emailData || null
        }
      }
    })
  )

  // Fetch shares where user has been granted access (to see which dashboards they can access)
  const { data: sharedWithMeRaw } = await supabase
    .from('dashboard_shares')
    .select(`
      *,
      owner:owner_user_id (
        id,
        username
      )
    `)
    .eq('shared_with_user_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch display names for owners
  const sharedWithMe = await Promise.all(
    (sharedWithMeRaw || []).map(async (share) => {
      const { data: displayName } = await supabase.rpc('get_user_display_name', {
        p_user_id: share.owner_user_id
      })
      return {
        ...share,
        owner: {
          ...share.owner,
          display_name: displayName || share.owner?.username || 'Unknown User'
        }
      }
    })
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <nav className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-8">
              <Link href="/dashboard" className="flex items-center hover:opacity-90 transition-opacity group">
                <Logo size="lg" variant="light" showText={false} />
              </Link>
              <div className="hidden md:flex items-center space-x-1">
                <Link
                  href="/dashboard/meetings"
                  className="px-4 py-2 text-sm font-semibold text-navy-700 hover:text-navy-900 hover:bg-navy-50 rounded-lg transition-all"
                >
                  Meetings
                </Link>
                <Link
                  href="/dashboard/availability"
                  className="px-4 py-2 text-sm font-semibold text-navy-700 hover:text-navy-900 hover:bg-navy-50 rounded-lg transition-all"
                >
                  Availability
                </Link>
                <Link
                  href="/dashboard/event-types"
                  className="px-4 py-2 text-sm font-semibold text-navy-700 hover:text-navy-900 hover:bg-navy-50 rounded-lg transition-all"
                >
                  Event Types
                </Link>
                <Link
                  href="/dashboard/group-event-types"
                  className="px-4 py-2 text-sm font-semibold text-navy-700 hover:text-navy-900 hover:bg-navy-50 rounded-lg transition-all"
                >
                  Group Events
                </Link>
                <Link
                  href="/dashboard/calendar"
                  className="px-4 py-2 text-sm font-semibold text-navy-700 hover:text-navy-900 hover:bg-navy-50 rounded-lg transition-all"
                >
                  Calendar
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600 hidden sm:block">{user.email}</span>
              <LogoutButton />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto py-10 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          <div className="mb-8">
            <Link
              href="/dashboard"
              className="inline-flex items-center text-navy-700 hover:text-navy-900 text-sm font-semibold transition-all group mb-4"
            >
              <span className="group-hover:-translate-x-1 transition-transform">←</span>
              <span className="ml-1">Back to Dashboard</span>
            </Link>
            <h1 className="text-4xl font-serif font-bold text-navy-900 tracking-tight">
              Share Dashboard
            </h1>
            <p className="mt-2 text-gray-600 text-lg">
              Grant other users access to view or edit your dashboard
            </p>
          </div>

          <DashboardSharingManager 
            initialShares={sharesWithEmails || []} 
            sharedWithMe={sharedWithMe || []}
          />
        </div>
      </main>
    </div>
  )
}


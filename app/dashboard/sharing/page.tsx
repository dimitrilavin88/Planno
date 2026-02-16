import { requireAuth } from '@/lib/auth/utils'
import { createClient } from '@/lib/supabase/server'
import DashboardSharingManager from '@/components/dashboard-sharing/dashboard-sharing-manager'
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

  // Fetch emails and display names for shared users
  const sharesWithEmails = await Promise.all(
    (shares || []).map(async (share) => {
      const { data: emailData } = await supabase.rpc('get_user_email', {
        p_user_id: share.shared_with_user_id
      })
      const { data: displayName } = await supabase.rpc('get_user_display_name', {
        p_user_id: share.shared_with_user_id
      })
      return {
        ...share,
        shared_with_user: {
          ...share.shared_with_user,
          email: emailData || null,
          display_name: displayName || share.shared_with_user?.username || 'Unknown User'
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
    <main className="max-w-4xl mx-auto py-6 sm:py-10 px-4 sm:px-6 lg:px-8">
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
  )
}


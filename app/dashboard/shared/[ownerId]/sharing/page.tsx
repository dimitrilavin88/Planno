import { requireAuth } from '@/lib/auth/utils'
import { createClient } from '@/lib/supabase/server'
import { checkDashboardAccess } from '@/lib/dashboard-access/utils'
import { redirect } from 'next/navigation'
import DashboardSharingManager from '@/components/dashboard-sharing/dashboard-sharing-manager'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ ownerId: string }>
}

export default async function SharedSharingPage({ params }: PageProps) {
  const user = await requireAuth()
  const resolvedParams = await params
  const ownerId = resolvedParams.ownerId
  const supabase = await createClient()

  const access = await checkDashboardAccess(user.id, ownerId, 'view')
  if (!access.hasAccess) {
    redirect('/dashboard')
  }

  const { data: ownerDisplayName } = await supabase.rpc('get_user_display_name', {
    p_user_id: ownerId,
  })
  const displayName = (ownerDisplayName && typeof ownerDisplayName === 'string') ? ownerDisplayName : 'User'

  const { data: shares } = await supabase
    .from('dashboard_shares')
    .select(`
      *,
      shared_with_user:shared_with_user_id (
        id,
        username
      )
    `)
    .eq('owner_user_id', ownerId)
    .order('created_at', { ascending: false })

  const sharesWithEmails = await Promise.all(
    (shares || []).map(async (share: { shared_with_user_id: string; shared_with_user?: { id: string; username: string } }) => {
      const { data: emailData } = await supabase.rpc('get_user_email', {
        p_user_id: share.shared_with_user_id,
      })
      const { data: displayNameData } = await supabase.rpc('get_user_display_name', {
        p_user_id: share.shared_with_user_id,
      })
      return {
        ...share,
        shared_with_user: {
          ...share.shared_with_user,
          email: emailData || null,
          display_name: displayNameData || share.shared_with_user?.username || 'Unknown User',
        },
      }
    })
  )

  return (
    <main className="max-w-4xl mx-auto py-6 sm:py-10 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          href={`/dashboard/shared/${ownerId}`}
          className="inline-flex text-navy-700 hover:text-navy-900 text-sm font-semibold group mb-4"
        >
          <span className="group-hover:-translate-x-1 transition-transform">←</span>
          <span className="ml-1">Back to {displayName}&apos;s Dashboard</span>
        </Link>
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-navy-900 tracking-tight">
          {displayName}&apos;s Dashboard Access
        </h1>
        <p className="mt-2 text-gray-600 text-lg">
          {access.permissionLevel === 'edit'
            ? 'Manage who has view or edit access to this dashboard'
            : 'View who has access to this dashboard'}
        </p>
      </div>

      {access.permissionLevel === 'edit' ? (
        <DashboardSharingManager
          initialShares={sharesWithEmails}
          sharedWithMe={[]}
          ownerUserId={ownerId}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {sharesWithEmails.length > 0 ? (
            <ul className="space-y-3">
              {sharesWithEmails.map((share: { id: string; permission_level: string; shared_with_user?: { display_name?: string; username?: string; email?: string } }) => (
                <li key={share.id} className="flex items-center justify-between p-4 rounded-lg bg-gray-50 border border-gray-100">
                  <span className="font-semibold text-navy-900">
                    {share.shared_with_user?.display_name || share.shared_with_user?.username || share.shared_with_user?.email || 'Unknown'}
                  </span>
                  <span className="text-sm text-gray-600 capitalize">{share.permission_level}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-600">No one has been granted access yet.</p>
          )}
        </div>
      )}
    </main>
  )
}

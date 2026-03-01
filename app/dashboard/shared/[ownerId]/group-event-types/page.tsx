import { requireAuth } from '@/lib/auth/utils'
import { createClient } from '@/lib/supabase/server'
import { checkDashboardAccess } from '@/lib/dashboard-access/utils'
import { redirect } from 'next/navigation'
import GroupEventTypesManager from '@/components/group-event-types/group-event-types-manager'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ ownerId: string }>
}

export default async function SharedGroupEventTypesPage({ params }: PageProps) {
  const user = await requireAuth()
  const resolvedParams = await params
  const ownerId = resolvedParams.ownerId
  const supabase = await createClient()

  const access = await checkDashboardAccess(user.id, ownerId, 'view')
  if (!access.hasAccess) {
    redirect('/dashboard')
  }

  const { data: ownerProfile } = await supabase
    .from('users')
    .select('username')
    .eq('id', ownerId)
    .single()

  const { data: ownerDisplayName } = await supabase.rpc('get_user_display_name', {
    p_user_id: ownerId,
  })
  const displayName = (ownerDisplayName && typeof ownerDisplayName === 'string') ? ownerDisplayName : ownerProfile?.username || 'User'

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'http://localhost:3000'

  // For shared dashboard: use owner's sharing to build available hosts (owner + people they share with + who share with them)
  const { data: sharesWhereOwner } = await supabase
    .from('dashboard_shares')
    .select('shared_with_user:shared_with_user_id(id, username)')
    .eq('owner_user_id', ownerId)
  const { data: sharesWhereOwnerIsSharedWith } = await supabase
    .from('dashboard_shares')
    .select('owner:owner_user_id(id, username)')
    .eq('shared_with_user_id', ownerId)

  const connectedUsersMap = new Map<string, { id: string; username: string }>()
  connectedUsersMap.set(ownerId, {
    id: ownerId,
    username: ownerProfile?.username || 'owner',
  })
  sharesWhereOwner?.forEach((share) => {
    const raw = (share as { shared_with_user?: { id: string; username: string } | { id: string; username: string }[] }).shared_with_user
    const u = Array.isArray(raw) ? raw[0] : raw
    if (u?.id) connectedUsersMap.set(u.id, { id: u.id, username: u.username || 'unknown' })
  })
  sharesWhereOwnerIsSharedWith?.forEach((share) => {
    const raw = (share as { owner?: { id: string; username: string } | { id: string; username: string }[] }).owner
    const u = Array.isArray(raw) ? raw[0] : raw
    if (u?.id) connectedUsersMap.set(u.id, { id: u.id, username: u.username || 'unknown' })
  })

  const availableHosts = await Promise.all(
    Array.from(connectedUsersMap.values()).map(async (host) => {
      const { data: displayLabel, error } = await supabase.rpc('get_user_host_display', {
        p_user_id: host.id,
      })
      return {
        id: host.id,
        username: host.username,
        displayLabel: (!error && displayLabel && typeof displayLabel === 'string') ? displayLabel : host.username,
      }
    })
  )

  const { data: groupEventTypes } = await supabase
    .from('group_event_types')
    .select(`
      *,
      hosts:group_event_type_hosts (
        user_id,
        users:user_id ( id, username )
      )
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const ownerGroups = groupEventTypes?.filter((group: { hosts?: { user_id: string }[] }) =>
    Array.isArray(group.hosts) && group.hosts.some((h: { user_id: string }) => h.user_id === ownerId)
  ) ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href={`/dashboard/shared/${ownerId}`}
            className="inline-flex text-navy-700 hover:text-navy-900 text-sm font-semibold group mb-4"
          >
            <span className="group-hover:-translate-x-1 transition-transform">←</span>
            <span className="ml-1">Back to {displayName}&apos;s Dashboard</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-navy-900">
            {displayName}&apos;s Group Event Types
          </h1>
          <p className="mt-2 text-gray-600">
            {access.permissionLevel === 'edit'
              ? 'Manage group event types for this dashboard'
              : 'View group event types (read-only)'}
          </p>
        </div>

        {access.permissionLevel === 'edit' ? (
          <GroupEventTypesManager
            initialGroups={ownerGroups}
            currentUserId={ownerId}
            availableHosts={availableHosts}
            baseUrl={baseUrl}
          />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            {ownerGroups.length > 0 ? (
              <ul className="space-y-3">
                {ownerGroups.map((group: { id: string; name: string; duration_minutes: number }) => {
                  const hours = Math.floor(group.duration_minutes / 60)
                  const minutes = group.duration_minutes % 60
                  const duration = hours > 0 ? `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`.trim() : `${minutes}m`
                  return (
                    <li key={group.id} className="p-4 rounded-lg bg-gray-50 border border-gray-100">
                      <span className="font-semibold text-navy-900">{group.name}</span>{' '}
                      <span className="text-gray-600">({duration})</span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-gray-600">No group event types.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

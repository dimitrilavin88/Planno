import { requireAuth } from '@/lib/auth/utils'
import { createClient } from '@/lib/supabase/server'
import GroupEventTypesManager from '@/components/group-event-types/group-event-types-manager'
import Link from 'next/link'

export default async function GroupEventTypesPage() {
  const user = await requireAuth()
  const supabase = await createClient()

  // Fetch current user's username
  const { data: currentUserProfile } = await supabase
    .from('users')
    .select('username')
    .eq('id', user.id)
    .single()

  // Fetch users connected via dashboard sharing (people I share with + people who share with me)
  const { data: sharesWhereIOwner } = await supabase
    .from('dashboard_shares')
    .select('shared_with_user:shared_with_user_id(id, username)')
    .eq('owner_user_id', user.id)

  const { data: sharesWhereISharedWith } = await supabase
    .from('dashboard_shares')
    .select('owner:owner_user_id(id, username)')
    .eq('shared_with_user_id', user.id)

  // Build unique list of available hosts (current user + connected users)
  const connectedUsersMap = new Map<string, { id: string; username: string }>()
  
  // Add current user first
  connectedUsersMap.set(user.id, {
    id: user.id,
    username: currentUserProfile?.username || 'me',
  })

  // Add users I share my dashboard with
  sharesWhereIOwner?.forEach((share: any) => {
    const u = share.shared_with_user
    if (u?.id) {
      connectedUsersMap.set(u.id, { id: u.id, username: u.username || 'unknown' })
    }
  })

  // Add users who share their dashboard with me
  sharesWhereISharedWith?.forEach((share: any) => {
    const u = share.owner
    if (u?.id) {
      connectedUsersMap.set(u.id, { id: u.id, username: u.username || 'unknown' })
    }
  })

  // Fetch display label (Last, First - username) for each host
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'http://localhost:3000'

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

  // Fetch group event types where user is a host
  const { data: groupEventTypes } = await supabase
    .from('group_event_types')
    .select(`
      *,
      hosts:group_event_type_hosts (
        user_id,
        users:user_id (
          id,
          username
        )
      )
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  // Filter to only show groups where user is a host
  const userGroups = groupEventTypes?.filter((group) =>
    Array.isArray(group.hosts)
      ? group.hosts.some((h: any) => h.user_id === user.id)
      : false
  ) || []

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-navy-900">Group Event Types</h1>
            <p className="mt-2 text-gray-600">
              Create event types that require multiple hosts. Only overlapping availability will be shown.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="min-h-[44px] flex items-center justify-center w-fit px-4 py-2.5 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors font-medium"
          >
            Back to Dashboard
          </Link>
        </div>

        <GroupEventTypesManager 
          initialGroups={userGroups} 
          currentUserId={user.id} 
          availableHosts={availableHosts}
          baseUrl={baseUrl}
        />
      </div>
    </div>
  )
}


import { requireAuth } from '@/lib/auth/utils'
import { createClient } from '@/lib/supabase/server'
import GroupEventTypesManager from '@/components/group-event-types/group-event-types-manager'
import Link from 'next/link'

export default async function GroupEventTypesPage() {
  const user = await requireAuth()
  const supabase = await createClient()

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
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold text-navy-900">Group Event Types</h1>
            <p className="mt-2 text-gray-600">
              Create event types that require multiple hosts. Only overlapping availability will be shown.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>

        <GroupEventTypesManager initialGroups={userGroups} currentUserId={user.id} />
      </div>
    </div>
  )
}


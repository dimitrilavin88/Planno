import { requireAuth } from '@/lib/auth/utils'
import { createClient } from '@/lib/supabase/server'
import { checkDashboardAccess } from '@/lib/dashboard-access/utils'
import { redirect } from 'next/navigation'
import EventTypesManager from '@/components/event-types/event-types-manager'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ ownerId: string }>
}

export default async function SharedEventTypesPage({ params }: PageProps) {
  const user = await requireAuth()
  const resolvedParams = await params
  const ownerId = resolvedParams.ownerId
  const supabase = await createClient()

  // Check if user has access to this dashboard
  const access = await checkDashboardAccess(user.id, ownerId, 'view')
  
  if (!access.hasAccess) {
    redirect('/dashboard')
  }

  // Get owner's display name
  const { data: ownerDisplayName } = await supabase.rpc('get_user_display_name', {
    p_user_id: ownerId
  })

  // Fetch owner's event types
  const { data: eventTypes } = await supabase
    .from('event_types')
    .select('*')
    .eq('user_id', ownerId)
    .order('created_at', { ascending: false })

  return (
    <main className="max-w-4xl mx-auto py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href={`/dashboard/shared/${ownerId}`}
            className="inline-flex items-center text-navy-700 hover:text-navy-900 text-sm font-semibold transition-all group mb-4"
          >
            <span className="group-hover:-translate-x-1 transition-transform">←</span>
            <span className="ml-1">Back to {ownerDisplayName || 'Dashboard'}&apos;s Dashboard</span>
          </Link>
          <h1 className="text-3xl font-serif font-bold text-navy-900">
            {ownerDisplayName || 'User'}&apos;s Event Types
          </h1>
          <p className="mt-2 text-gray-600">
            {access.permissionLevel === 'edit' 
              ? 'Create and manage event types for this dashboard' 
              : 'View event types for this dashboard (read-only)'}
          </p>
        </div>

        <EventTypesManager 
          initialEventTypes={eventTypes || []} 
          isSharedDashboard={true}
          ownerUserId={ownerId}
          canEdit={access.permissionLevel === 'edit'}
        />
    </main>
  )
}


import { requireAuth } from '@/lib/auth/utils'
import { createClient } from '@/lib/supabase/server'
import { checkDashboardAccess } from '@/lib/dashboard-access/utils'
import { redirect } from 'next/navigation'
import AvailabilityManager from '@/components/availability/availability-manager'
import LogoutButton from '@/components/auth/logout-button'
import Logo from '@/components/logo'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ ownerId: string }>
}

export default async function SharedAvailabilityPage({ params }: PageProps) {
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

  // Fetch owner's availability rules
  const { data: availabilityRules } = await supabase
    .from('availability_rules')
    .select('*')
    .eq('user_id', ownerId)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })

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
                <Link
                  href="/dashboard/sharing"
                  className="px-4 py-2 text-sm font-semibold text-navy-700 hover:text-navy-900 hover:bg-navy-50 rounded-lg transition-all"
                >
                  Sharing
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

      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href={`/dashboard/shared/${ownerId}`}
            className="inline-flex items-center text-navy-700 hover:text-navy-900 text-sm font-semibold transition-all group mb-4"
          >
            <span className="group-hover:-translate-x-1 transition-transform">←</span>
            <span className="ml-1">Back to {ownerDisplayName || 'Dashboard'}&apos;s Dashboard</span>
          </Link>
          <h1 className="text-3xl font-serif font-bold text-navy-900">
            {ownerDisplayName || 'User'}&apos;s Availability
          </h1>
          <p className="mt-2 text-gray-600">
            {access.permissionLevel === 'edit' 
              ? 'Manage availability for this dashboard' 
              : 'View availability for this dashboard (read-only)'}
          </p>
        </div>

        <AvailabilityManager 
          initialRules={availabilityRules || []} 
          isSharedDashboard={true}
          ownerUserId={ownerId}
          canEdit={access.permissionLevel === 'edit'}
        />
      </main>
    </div>
  )
}


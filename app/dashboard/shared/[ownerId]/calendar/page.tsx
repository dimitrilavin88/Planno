import { requireAuth } from '@/lib/auth/utils'
import { createClient } from '@/lib/supabase/server'
import { checkDashboardAccess } from '@/lib/dashboard-access/utils'
import { redirect } from 'next/navigation'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ ownerId: string }>
}

export default async function SharedCalendarPage({ params }: PageProps) {
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

  const { data: calendars } = await supabase
    .from('calendars')
    .select('provider, calendar_name, is_active')
    .eq('user_id', ownerId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: false })

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
            {displayName}&apos;s Calendar
          </h1>
          <p className="mt-2 text-gray-600">
            Connected calendars for this account. Only the account owner can connect or disconnect calendars.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {calendars && calendars.length > 0 ? (
            <ul className="space-y-3">
              {calendars.map((cal: { provider: string }, idx: number) => {
                const name = cal.provider === 'google' ? 'Google' : cal.provider === 'outlook' ? 'Outlook' : cal.provider === 'apple' ? 'Apple' : cal.provider.charAt(0).toUpperCase() + cal.provider.slice(1)
                return (
                  <li key={idx} className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 border border-gray-100">
                    <span className="font-semibold text-green-600">✓</span>
                    <span className="font-semibold text-navy-900">{name}</span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-gray-600">No calendars connected.</p>
          )}
        </div>
      </div>
    </div>
  )
}

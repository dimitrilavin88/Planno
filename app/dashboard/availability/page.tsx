import { requireAuth } from '@/lib/auth/utils'
import { createClient } from '@/lib/supabase/server'
import AvailabilityManager from '@/components/availability/availability-manager'
import Link from 'next/link'

export default async function AvailabilityPage() {
  const user = await requireAuth()
  const supabase = await createClient()

  // Fetch user's availability rules
  const { data: availabilityRules } = await supabase
    .from('availability_rules')
    .select('*')
    .eq('user_id', user.id)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold text-navy-900">Availability</h1>
            <p className="mt-2 text-gray-600">
              Set your weekly availability. You can add multiple time windows per day.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>

        <AvailabilityManager initialRules={availabilityRules || []} />
      </div>
    </div>
  )
}


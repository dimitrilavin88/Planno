import { requireAuth } from '@/lib/auth/utils'
import DashboardNav from '@/components/dashboard/dashboard-nav'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAuth()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <DashboardNav userEmail={user.email || ''} />
      {children}
    </div>
  )
}

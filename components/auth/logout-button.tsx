'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="min-h-[44px] min-w-[44px] px-5 py-2.5 flex items-center justify-center text-sm font-semibold text-navy-900 bg-white border-2 border-navy-200 rounded-xl hover:bg-navy-50 hover:border-navy-300 transition-all duration-300 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
    >
      Sign out
    </button>
  )
}


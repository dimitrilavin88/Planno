'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface TimezoneSyncProps {
  storedTimezone: string
}

export default function TimezoneSync({ storedTimezone }: TimezoneSyncProps) {
  const router = useRouter()
  const hasSynced = useRef(false)

  useEffect(() => {
    if (hasSynced.current) return

    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (!detected || detected === storedTimezone) return

      hasSynced.current = true

      const sync = async () => {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase
          .from('users')
          .update({ timezone: detected })
          .eq('id', user.id)

        if (!error) {
          router.refresh()
        }
      }

      sync()
    } catch {
      // Ignore detection errors
    }
  }, [storedTimezone, router])

  return null
}

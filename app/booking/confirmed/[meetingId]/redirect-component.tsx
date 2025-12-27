'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface RedirectToHostSchedulingProps {
  hostUsername: string
  delaySeconds?: number
}

export function RedirectToHostScheduling({ 
  hostUsername, 
  delaySeconds = 5 
}: RedirectToHostSchedulingProps) {
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push(`/${hostUsername}`)
    }, delaySeconds * 1000)

    return () => clearTimeout(timer)
  }, [hostUsername, delaySeconds, router])

  return (
    <p className="text-sm text-gray-500 text-center">
      Redirecting to {hostUsername}&apos;s scheduling page in {delaySeconds} seconds...
    </p>
  )
}


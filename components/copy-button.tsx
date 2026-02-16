'use client'

import { useState } from 'react'

interface CopyButtonProps {
  text: string
}

export default function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex-shrink-0 min-h-[48px] px-5 py-3 flex items-center justify-center bg-gradient-to-r from-navy-900 to-navy-800 text-white rounded-xl hover:from-navy-800 hover:to-navy-700 text-sm font-semibold disabled:opacity-50 transition-all duration-300 shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
      disabled={copied}
    >
      {copied ? '✓ Copied!' : 'Copy'}
    </button>
  )
}


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
      onClick={handleCopy}
      className="px-5 py-2.5 bg-gradient-to-r from-navy-900 to-navy-800 text-white rounded-xl hover:from-navy-800 hover:to-navy-700 text-sm font-semibold disabled:opacity-50 transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 active:scale-95"
      disabled={copied}
    >
      {copied ? '✓ Copied!' : 'Copy'}
    </button>
  )
}


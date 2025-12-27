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
      className="px-4 py-2 bg-navy-900 text-white rounded-md hover:bg-navy-800 text-sm disabled:opacity-50 transition-colors"
      disabled={copied}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}


import Link from 'next/link'
import Image from 'next/image'

interface LogoProps {
  className?: string
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
  href?: string
  variant?: 'light' | 'dark' // light = dark text on light bg, dark = light text on dark bg
}

export default function Logo({ 
  className = '', 
  showText = true, 
  size = 'md',
  href,
  variant = 'light'
}: LogoProps) {
  // Size classes for the logo image (cropped version)
  const sizeClasses = {
    sm: 'h-7 w-auto', // Height-based sizing
    md: 'h-10 w-auto',
    lg: 'h-14 w-auto', // Header size - slightly smaller
  }

  const content = (
    <div className={`flex items-center ${className}`}>
      <Image
        src="/logo.png"
        alt="Planno Logo"
        width={size === 'sm' ? 90 : size === 'md' ? 130 : 220}
        height={size === 'sm' ? 28 : size === 'md' ? 40 : 56}
        className={sizeClasses[size]}
        priority
        style={{ objectFit: 'contain' }}
      />
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="inline-block">
        {content}
      </Link>
    )
  }

  return content
}


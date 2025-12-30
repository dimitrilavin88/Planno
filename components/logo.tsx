import Link from 'next/link'

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
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  }

  const textSizeClasses = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl',
  }

  const content = (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Logo Icon */}
      <div className={`${sizeClasses[size]} relative flex-shrink-0`}>
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Circular arrows */}
          <path
            d="M32 8 C32 8, 24 12, 20 16 C16 20, 12 28, 12 32"
            stroke={variant === 'dark' ? '#ffffff' : '#102a43'}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M32 56 C32 56, 40 52, 44 48 C48 44, 52 36, 52 32"
            stroke={variant === 'dark' ? '#ffffff' : '#102a43'}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
          
          {/* Calendar */}
          <rect
            x="16"
            y="20"
            width="32"
            height="28"
            rx="2"
            stroke={variant === 'dark' ? '#ffffff' : '#102a43'}
            strokeWidth="2.5"
            fill="none"
          />
          
          {/* Calendar grid lines */}
          <line x1="24" y1="20" x2="24" y2="48" stroke={variant === 'dark' ? '#ffffff' : '#102a43'} strokeWidth="1.5" />
          <line x1="32" y1="20" x2="32" y2="48" stroke={variant === 'dark' ? '#ffffff' : '#102a43'} strokeWidth="1.5" />
          <line x1="40" y1="20" x2="40" y2="48" stroke={variant === 'dark' ? '#ffffff' : '#102a43'} strokeWidth="1.5" />
          <line x1="16" y1="28" x2="48" y2="28" stroke={variant === 'dark' ? '#ffffff' : '#102a43'} strokeWidth="1.5" />
          <line x1="16" y1="36" x2="48" y2="36" stroke={variant === 'dark' ? '#ffffff' : '#102a43'} strokeWidth="1.5" />
          <line x1="16" y1="44" x2="48" y2="44" stroke={variant === 'dark' ? '#ffffff' : '#102a43'} strokeWidth="1.5" />
          
          {/* Checkmark in calendar square */}
          <path
            d="M26 32 L30 36 L38 28"
            stroke={variant === 'dark' ? '#ffffff' : '#102a43'}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          
          {/* Clock below calendar */}
          <circle
            cx="32"
            cy="52"
            r="6"
            stroke={variant === 'dark' ? '#ffffff' : '#102a43'}
            strokeWidth="2"
            fill="none"
          />
          <line
            x1="32"
            y1="52"
            x2="32"
            y2="49"
            stroke={variant === 'dark' ? '#ffffff' : '#102a43'}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="32"
            y1="52"
            x2="34"
            y2="52"
            stroke={variant === 'dark' ? '#ffffff' : '#102a43'}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Logo Text */}
      {showText && (
        <span className={`font-bold ${textSizeClasses[size]} tracking-tight`}>
          {variant === 'dark' ? (
            <>
              <span className="text-white">P</span>
              <span className="text-white">l</span>
              <span className="text-blue-400">a</span>
              <span className="text-white">n</span>
              <span className="text-blue-400">n</span>
              <span className="text-white">o</span>
            </>
          ) : (
            <>
              <span className="text-navy-900">P</span>
              <span className="text-navy-900">l</span>
              <span className="text-blue-500">a</span>
              <span className="text-navy-900">n</span>
              <span className="text-blue-500">n</span>
              <span className="text-navy-900">o</span>
            </>
          )}
        </span>
      )}
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


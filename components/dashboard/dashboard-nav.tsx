'use client'

import { useState } from 'react'
import Link from 'next/link'
import Logo from '@/components/logo'
import LogoutButton from '@/components/auth/logout-button'

interface DashboardNavProps {
  userEmail: string
}

const navLinks = [
  { href: '/dashboard/meetings', label: 'Meetings' },
  { href: '/dashboard/availability', label: 'Availability' },
  { href: '/dashboard/event-types', label: 'Event Types' },
  { href: '/dashboard/group-event-types', label: 'Group Events' },
  { href: '/dashboard/calendar', label: 'Calendar' },
  { href: '/dashboard/sharing', label: 'Sharing' },
]

export default function DashboardNav({ userEmail }: DashboardNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 sm:h-20">
          <div className="flex items-center gap-4 sm:gap-8">
            <Link href="/dashboard" className="flex items-center hover:opacity-90 transition-opacity">
              <Logo size="lg" variant="light" showText={false} />
            </Link>
            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2.5 text-sm font-semibold text-navy-700 hover:text-navy-900 hover:bg-navy-50 rounded-lg transition-all min-h-[44px] flex items-center"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="text-sm text-gray-600 hidden sm:block truncate max-w-[180px] lg:max-w-none">
              {userEmail}
            </span>
            <LogoutButton />
            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2.5 rounded-lg text-navy-700 hover:bg-navy-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center -mr-2"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-4 py-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3.5 text-base font-semibold text-navy-700 hover:text-navy-900 hover:bg-navy-50 rounded-lg transition-all min-h-[48px] flex items-center"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}

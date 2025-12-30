'use client'

import { useState } from 'react'

interface Meeting {
  title: string
  description: string
  startTime: string
  endTime: string
  location: string
  timezone: string
}

interface AddToCalendarButtonProps {
  meeting: Meeting
}

export default function AddToCalendarButton({ meeting }: AddToCalendarButtonProps) {
  const [showOptions, setShowOptions] = useState(false)

  // Format date for Google Calendar URL (YYYYMMDDTHHmmssZ format)
  const formatGoogleDate = (date: Date): string => {
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    const hours = String(date.getUTCHours()).padStart(2, '0')
    const minutes = String(date.getUTCMinutes()).padStart(2, '0')
    const seconds = String(date.getUTCSeconds()).padStart(2, '0')
    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
  }

  // Generate Google Calendar URL
  const getGoogleCalendarUrl = (): string => {
    const startDate = new Date(meeting.startTime)
    const endDate = new Date(meeting.endTime)
    
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: meeting.title,
      dates: `${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`,
      details: meeting.description,
      location: meeting.location,
    })

    return `https://calendar.google.com/calendar/render?${params.toString()}`
  }

  // Generate .ics file content
  const generateICS = (): string => {
    const startDate = new Date(meeting.startTime)
    const endDate = new Date(meeting.endTime)
    
    // Format date for ICS (YYYYMMDDTHHmmssZ)
    const formatICSDate = (date: Date): string => {
      const year = date.getUTCFullYear()
      const month = String(date.getUTCMonth() + 1).padStart(2, '0')
      const day = String(date.getUTCDate()).padStart(2, '0')
      const hours = String(date.getUTCHours()).padStart(2, '0')
      const minutes = String(date.getUTCMinutes()).padStart(2, '0')
      const seconds = String(date.getUTCSeconds()).padStart(2, '0')
      return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
    }

    // Escape special characters for ICS format
    const escapeICS = (text: string): string => {
      return text
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n')
    }

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Planno//Meeting Booking//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${Date.now()}@planno.app`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART:${formatICSDate(startDate)}`,
      `DTEND:${formatICSDate(endDate)}`,
      `SUMMARY:${escapeICS(meeting.title)}`,
      meeting.description ? `DESCRIPTION:${escapeICS(meeting.description)}` : '',
      meeting.location ? `LOCATION:${escapeICS(meeting.location)}` : '',
      'STATUS:CONFIRMED',
      'SEQUENCE:0',
      'END:VEVENT',
      'END:VCALENDAR',
    ]
      .filter(line => line !== '')
      .join('\r\n')

    return icsContent
  }

  // Download .ics file
  const downloadICS = () => {
    const icsContent = generateICS()
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${meeting.title.replace(/[^a-z0-9]/gi, '_')}.ics`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setShowOptions(false)
  }

  // Open Google Calendar
  const openGoogleCalendar = () => {
    window.open(getGoogleCalendarUrl(), '_blank')
    setShowOptions(false)
  }

  if (!showOptions) {
    return (
      <button
        onClick={() => setShowOptions(true)}
        className="w-full px-4 py-2 bg-navy-900 text-white rounded-md hover:bg-navy-800 transition-colors font-medium"
      >
        Add to Calendar
      </button>
    )
  }

  return (
    <div className="space-y-2">
      <button
        onClick={openGoogleCalendar}
        className="w-full px-4 py-2 bg-white border-2 border-navy-900 text-navy-900 rounded-md hover:bg-navy-50 transition-colors font-medium flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/>
        </svg>
        Add to Google Calendar
      </button>
      
      <button
        onClick={downloadICS}
        className="w-full px-4 py-2 bg-white border-2 border-navy-900 text-navy-900 rounded-md hover:bg-navy-50 transition-colors font-medium flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Download for Apple Calendar
      </button>
      
      <button
        onClick={() => setShowOptions(false)}
        className="w-full px-4 py-2 text-gray-600 hover:text-gray-800 text-sm transition-colors"
      >
        Cancel
      </button>
    </div>
  )
}


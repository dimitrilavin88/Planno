'use client'

interface Meeting {
  id: string
  title: string
  description?: string | null
  start_time: string
  end_time: string
  location?: string | null
  timezone: string
  event_types?: {
    name: string
    description?: string | null
    location?: string | null
  } | Array<{
    name: string
    description?: string | null
    location?: string | null
  }> | null
}

interface DownloadICSButtonProps {
  meeting: Meeting
}

export default function DownloadICSButton({ meeting }: DownloadICSButtonProps) {
  const generateICS = (): string => {
    const startDate = new Date(meeting.start_time)
    const endDate = new Date(meeting.end_time)
    
    // Get event type info
    const eventType = Array.isArray(meeting.event_types) 
      ? meeting.event_types[0] 
      : meeting.event_types
    
    const title = eventType?.name || meeting.title || 'Meeting'
    const description = eventType?.description || meeting.description || ''
    const location = eventType?.location || meeting.location || ''

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
      `UID:${meeting.id}@planno.app`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART:${formatICSDate(startDate)}`,
      `DTEND:${formatICSDate(endDate)}`,
      `SUMMARY:${escapeICS(title)}`,
      description ? `DESCRIPTION:${escapeICS(description)}` : '',
      location ? `LOCATION:${escapeICS(location)}` : '',
      'STATUS:CONFIRMED',
      'SEQUENCE:0',
      'END:VEVENT',
      'END:VCALENDAR',
    ]
      .filter(line => line !== '')
      .join('\r\n')

    return icsContent
  }

  const downloadICS = () => {
    const icsContent = generateICS()
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    
    const eventType = Array.isArray(meeting.event_types) 
      ? meeting.event_types[0] 
      : meeting.event_types
    const title = eventType?.name || meeting.title || 'meeting'
    link.download = `${title.replace(/[^a-z0-9]/gi, '_')}.ics`
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={downloadICS}
      className="px-3 py-1 text-sm bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors flex items-center gap-1"
      title="Download for Apple Calendar"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      .ics
    </button>
  )
}


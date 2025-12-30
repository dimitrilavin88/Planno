import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/utils'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const user = await requireAuth()
  const supabase = await createClient()

  try {
    const { calendarId } = await request.json()

    if (!calendarId) {
      return NextResponse.json(
        { error: 'Calendar ID is required' },
        { status: 400 }
      )
    }

    // Deactivate the calendar connection
    const { error } = await supabase
      .from('calendars')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', calendarId)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to disconnect calendar' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    )
  }
}


# Google Calendar Integration Setup Guide

This guide explains how to set up Google Calendar integration for hosts in your Planno application.

## Overview

The Google Calendar integration allows hosts to:

- Connect their Google Calendar via OAuth
- Automatically sync meetings to their Google Calendar when booked
- Update calendar events when meetings are rescheduled
- Delete calendar events when meetings are cancelled

## Prerequisites

1. A Google Cloud Project
2. Google Calendar API enabled
3. OAuth 2.0 credentials configured

## Step 1: Set Up Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Calendar API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

## Step 2: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" (unless you have a Google Workspace)
   - Fill in required fields (App name, User support email, Developer contact)
   - Add scopes: `https://www.googleapis.com/auth/calendar.events` and `https://www.googleapis.com/auth/calendar.readonly`
   - Add test users (for development)
4. Create OAuth 2.0 Client ID:
   - Application type: **Web application**
   - Name: "Planno Calendar Integration"
   - Authorized redirect URIs:
     - Development: `http://localhost:3000/api/calendar/google/callback`
     - Production: `https://your-domain.vercel.app/api/calendar/google/callback`
5. Copy the **Client ID** and **Client Secret**

## Step 3: Set Environment Variables

Add these environment variables to your Vercel project and `.env.local`:

### Vercel Environment Variables

```env
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=https://your-domain.vercel.app/api/calendar/google/callback
```

### Local Development (.env.local)

```env
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/calendar/google/callback
```

**Note:** The redirect URI must exactly match what you configured in Google Cloud Console.

## Step 4: How It Works

### For Hosts:

1. **Connect Calendar:**

   - Go to Dashboard > Calendar Integration
   - Click "Connect" next to Google Calendar
   - Authorize access in Google's OAuth flow
   - Calendar is now connected

2. **Automatic Sync:**

   - When a guest books a meeting, it's automatically added to the host's Google Calendar
   - When a meeting is rescheduled, the calendar event is updated
   - When a meeting is cancelled, the calendar event is deleted

3. **Apple Calendar:**
   - Hosts can download .ics files from the meetings page
   - These can be imported into Apple Calendar manually

### For Guests:

- Guests can add meetings to their calendar using the "Add to Calendar" button on the confirmation page
- Options: Google Calendar (opens in new tab) or .ics download (for Apple Calendar)

## Step 5: Testing

1. **Test OAuth Flow:**

   - Go to `/dashboard/calendar`
   - Click "Connect" for Google Calendar
   - Complete the OAuth flow
   - Verify calendar appears in "Active Connections"

2. **Test Calendar Sync:**
   - Book a meeting as a guest
   - Check the host's Google Calendar - event should appear automatically
   - Reschedule the meeting - calendar event should update
   - Cancel the meeting - calendar event should be deleted

## Troubleshooting

### "Calendar access was denied"

- User cancelled the OAuth flow
- Try connecting again

### "Token exchange failed"

- Check that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Verify redirect URI matches exactly

### "Failed to create calendar event"

- Check that Google Calendar API is enabled
- Verify OAuth scopes include calendar write access
- Check token hasn't expired (should auto-refresh)

### Calendar events not syncing

- Verify calendar is connected and active
- Check browser console for errors
- Verify Supabase Edge Function is deployed and accessible

## Security Notes

- OAuth tokens are stored in the `calendars` table
- In production, consider encrypting `access_token` and `refresh_token`
- Tokens are automatically refreshed when they expire
- Users can disconnect calendars at any time

## API Routes Created

- `GET /api/calendar/google/connect` - Initiates OAuth flow
- `GET /api/calendar/google/callback` - Handles OAuth callback
- `POST /api/calendar/google/disconnect` - Disconnects calendar
- `POST /api/calendar/sync` - Syncs meeting to calendar (called after booking)
- `POST /api/calendar/update` - Updates calendar event (called on reschedule)
- `POST /api/calendar/delete` - Deletes calendar event (called on cancel)

## Edge Functions

- `supabase/functions/create-calendar-event/index.ts` - Creates calendar events via Google Calendar API

## Next Steps

1. Set up Google Cloud Project and OAuth credentials
2. Add environment variables to Vercel
3. Test the OAuth flow
4. Test calendar sync with a real booking

# Calendar Sync Troubleshooting Guide

## Error: POST /api/calendar/sync 500

If you're seeing a 500 error when trying to sync meetings to Google Calendar, follow these steps:

## Step 1: Check Vercel Environment Variables

Make sure these are set in **Vercel Dashboard → Settings → Environment Variables**:

- ✅ `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (NOT the anon key!)

**To find your service role key:**
1. Go to Supabase Dashboard
2. Settings → API
3. Copy the **service_role** key (NOT the anon/public key)
4. This key has admin privileges and is needed for Edge Functions

## Step 2: Deploy the Edge Function

The `create-calendar-event` Edge Function must be deployed to Supabase:

```bash
# Install Supabase CLI if needed
npm install -g supabase

# Login to Supabase
supabase login

# Link your project (get project ref from Supabase Dashboard URL)
supabase link --project-ref your-project-ref

# Deploy the function
supabase functions deploy create-calendar-event
```

## Step 3: Set Edge Function Environment Variables

In **Supabase Dashboard → Settings → Edge Functions → Environment Variables**, add:

- ✅ `GOOGLE_CLIENT_ID` - Your Google OAuth Client ID
- ✅ `GOOGLE_CLIENT_SECRET` - Your Google OAuth Client Secret
- ✅ `SUPABASE_URL` - Your Supabase project URL (usually auto-set, but verify)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

**Important:** These are separate from your Vercel environment variables!

## Step 4: Verify Edge Function is Deployed

1. Go to **Supabase Dashboard → Edge Functions**
2. You should see `create-calendar-event` in the list
3. Click on it to see logs and verify it's active

## Step 5: Test the Edge Function Directly

You can test the Edge Function using curl or Postman:

```bash
curl -X POST \
  https://your-project.supabase.co/functions/v1/create-calendar-event \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"meeting_id": "your-meeting-id-here"}'
```

Replace:
- `your-project.supabase.co` with your actual Supabase URL
- `YOUR_SERVICE_ROLE_KEY` with your service role key
- `your-meeting-id-here` with an actual meeting ID from your database

## Step 6: Check Browser Console

1. Open browser DevTools (F12)
2. Go to Console tab
3. Book a meeting
4. Look for error messages that might give more details

## Step 7: Check Supabase Edge Function Logs

1. Go to **Supabase Dashboard → Edge Functions → create-calendar-event**
2. Click on **Logs** tab
3. Look for error messages when a sync is attempted

## Common Issues

### Issue: "Supabase configuration missing"
- **Cause:** Missing `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_URL` in Vercel
- **Fix:** Add these environment variables in Vercel

### Issue: "Function not found" or 404
- **Cause:** Edge Function not deployed
- **Fix:** Deploy the function using `supabase functions deploy create-calendar-event`

### Issue: "Missing Google OAuth credentials"
- **Cause:** `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` not set in Supabase Edge Functions
- **Fix:** Add these in Supabase Dashboard → Settings → Edge Functions → Environment Variables

### Issue: "Meeting not found"
- **Cause:** The meeting ID doesn't exist or RLS is blocking access
- **Fix:** Verify the meeting exists and the service role key has proper permissions

### Issue: "Failed to refresh Google token"
- **Cause:** Refresh token is invalid or expired
- **Fix:** Reconnect your Google Calendar in `/dashboard/calendar`

## Quick Checklist

- [ ] `NEXT_PUBLIC_SUPABASE_URL` set in Vercel
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set in Vercel (service_role key, not anon key!)
- [ ] Edge Function `create-calendar-event` is deployed
- [ ] `GOOGLE_CLIENT_ID` set in Supabase Edge Functions
- [ ] `GOOGLE_CLIENT_SECRET` set in Supabase Edge Functions
- [ ] `SUPABASE_URL` set in Supabase Edge Functions
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set in Supabase Edge Functions
- [ ] Google Calendar is connected in `/dashboard/calendar`
- [ ] Test meeting booking triggers sync

## Still Not Working?

1. Check Vercel logs for detailed error messages
2. Check Supabase Edge Function logs
3. Verify all environment variables are set correctly
4. Try testing the Edge Function directly with curl
5. Make sure you're using the **service_role** key, not the anon key


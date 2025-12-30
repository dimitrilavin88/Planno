# Google OAuth Troubleshooting Guide

## Error: "invalid_client" (Error 401)

This error means Google cannot find your OAuth client. Here's how to fix it:

### Step 1: Verify Environment Variables

Check that these are set in your Vercel project:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Verify these variables exist:
   - `GOOGLE_CLIENT_ID` - Should start with something like `123456789-abc...`
   - `GOOGLE_CLIENT_SECRET` - Should be a long string
   - `GOOGLE_REDIRECT_URI` (optional, but recommended)

### Step 2: Check Your Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to **APIs & Services** → **Credentials**
4. Find your OAuth 2.0 Client ID
5. Click on it to edit

### Step 3: Verify Redirect URI

**CRITICAL:** The redirect URI in your code MUST exactly match what's in Google Cloud Console.

#### For Production (Vercel):
- In Google Cloud Console, add: `https://your-domain.vercel.app/api/calendar/google/callback`
- In Vercel, set: `GOOGLE_REDIRECT_URI=https://your-domain.vercel.app/api/calendar/google/callback`

#### For Local Development:
- In Google Cloud Console, add: `http://localhost:3000/api/calendar/google/callback`
- In `.env.local`, set: `GOOGLE_REDIRECT_URI=http://localhost:3000/api/calendar/google/callback`

**Important Notes:**
- The URI must match **exactly** (including `http://` vs `https://`)
- No trailing slashes
- Must include the full path: `/api/calendar/google/callback`

### Step 4: Verify OAuth Client Setup

In Google Cloud Console, your OAuth client should have:

1. **Application type:** Web application
2. **Authorized redirect URIs:** Should include your callback URL
3. **Scopes:** Should include:
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/calendar.readonly`

### Step 5: Check OAuth Consent Screen (IMPORTANT!)

This is the most common issue! If your app is in "Testing" mode, you MUST add test users.

1. Go to **APIs & Services** → **OAuth consent screen**
2. Scroll down to **Test users** section
3. Click **+ ADD USERS**
4. Add your email address (the one you're using to sign in)
5. Click **ADD**
6. **Important:** You may need to wait a few minutes for changes to propagate

**If you want to make it public (not recommended for production until verified):**
- Change "Publishing status" from "Testing" to "In production"
- Note: This requires app verification if you use sensitive scopes

### Step 6: Common Issues

#### Issue: "Redirect URI mismatch"
- **Solution:** The redirect URI in your code doesn't match Google Cloud Console
- **Fix:** Copy the exact URI from your code and paste it into Google Cloud Console

#### Issue: "Client ID not found"
- **Solution:** The `GOOGLE_CLIENT_ID` in your environment variables doesn't match any OAuth client
- **Fix:** Copy the Client ID from Google Cloud Console and update your environment variable

#### Issue: "Invalid client secret"
- **Solution:** The `GOOGLE_CLIENT_SECRET` is incorrect
- **Fix:** If you don't have the secret, create a new OAuth client in Google Cloud Console

### Step 7: Testing

1. **Check environment variables are loaded:**
   - Add a console.log in your connect route (temporarily)
   - Or check Vercel logs after clicking "Connect"

2. **Test the redirect URI:**
   - The redirect URI should be logged in your server console
   - Compare it exactly with what's in Google Cloud Console

3. **Clear browser cache:**
   - Sometimes OAuth errors are cached
   - Try incognito mode or clear cookies

### Quick Checklist

- [ ] `GOOGLE_CLIENT_ID` is set in Vercel
- [ ] `GOOGLE_CLIENT_SECRET` is set in Vercel
- [ ] `GOOGLE_REDIRECT_URI` matches exactly in both places
- [ ] OAuth client exists in Google Cloud Console
- [ ] Redirect URI is added to Authorized redirect URIs
- [ ] OAuth consent screen is configured
- [ ] You're a test user (if app is in testing mode)
- [ ] Google Calendar API is enabled

### Still Having Issues?

1. Check Vercel logs for the actual redirect URI being used
2. Compare it character-by-character with Google Cloud Console
3. Make sure there are no extra spaces or characters
4. Try creating a new OAuth client with a fresh Client ID and Secret


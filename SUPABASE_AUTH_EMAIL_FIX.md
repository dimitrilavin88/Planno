# Fix Supabase Auth Email Links (localhost → Production)

## Problem
Supabase confirmation emails are sending links with `localhost:3000` instead of your production deployment URL.

## Root Cause
Supabase uses the **Site URL** configured in the Supabase Dashboard as the base URL for constructing email links. Even if you pass `emailRedirectTo` in your code, Supabase will use the Site URL as the base.

## Solution

### Step 1: Update Supabase Dashboard Site URL

1. **Go to Supabase Dashboard:**
   - Navigate to https://supabase.com/dashboard
   - Select your project

2. **Update Site URL:**
   - Go to **Authentication** → **URL Configuration**
   - Find the **Site URL** field
   - Change it from `http://localhost:3000` to your production URL:
     ```
     https://your-app.vercel.app
     ```
     or your custom domain:
     ```
     https://your-custom-domain.com
     ```

3. **Add Redirect URLs:**
   - In the same section, under **Redirect URLs**, add:
     ```
     https://your-app.vercel.app/auth/callback
     https://your-custom-domain.com/auth/callback
     ```
   - **Keep localhost for development:**
     ```
     http://localhost:3000/auth/callback
     ```

4. **Save Changes**

### Step 2: Set Environment Variable in Vercel

1. **Go to Vercel Dashboard:**
   - Navigate to your project
   - Go to **Settings** → **Environment Variables**

2. **Add/Update Environment Variable:**
   - **Key:** `NEXT_PUBLIC_SITE_URL`
   - **Value:** Your production URL (e.g., `https://your-app.vercel.app`)
   - **Environment:** Production (and Preview if you want)

3. **Redeploy:**
   - After adding the environment variable, trigger a new deployment
   - Or wait for the next automatic deployment

### Step 3: Verify the Fix

1. **Test Signup:**
   - Sign up a new user on your production site
   - Check the confirmation email
   - The link should now point to your production URL, not localhost

2. **Test Magic Link:**
   - Request a magic link on your production site
   - Check the email
   - The link should point to your production URL

## How It Works

1. **Supabase Site URL:**
   - This is the **primary** setting that Supabase uses to construct email links
   - It's used as the base URL for all authentication emails

2. **Code `emailRedirectTo`:**
   - This tells Supabase where to redirect after the user clicks the link
   - But the full email link is still constructed using the Site URL

3. **Environment Variables:**
   - `NEXT_PUBLIC_SITE_URL` is used by the code to determine the correct redirect URL
   - `VERCEL_URL` is automatically provided by Vercel and can be used as a fallback

## Important Notes

- **The Supabase Dashboard Site URL is the most important setting** - this is what Supabase uses to build email links
- Always keep both production and localhost URLs in the Redirect URLs list
- After changing the Site URL in Supabase, new emails will use the new URL
- Old emails that were already sent will still have the old URL (they're already sent)

## Troubleshooting

**Issue:** Links still go to localhost after updating Site URL
- **Solution:** 
  1. Make sure you saved the changes in Supabase Dashboard
  2. Sign up a NEW user (old emails won't change)
  3. Check that the Site URL in Supabase exactly matches your production domain

**Issue:** "Invalid redirect URL" error
- **Solution:** 
  1. Add the exact redirect URL to Supabase Dashboard → Authentication → Redirect URLs
  2. Make sure it includes `/auth/callback` at the end
  3. Include both production and localhost URLs

**Issue:** Works locally but not in production
- **Solution:**
  1. Verify Site URL in Supabase Dashboard is your production domain
  2. Verify `NEXT_PUBLIC_SITE_URL` is set in Vercel (not just locally)
  3. Redeploy after adding environment variables

## Quick Checklist

- [ ] Updated Supabase Dashboard → Authentication → URL Configuration → Site URL to production URL
- [ ] Added production callback URL to Redirect URLs list
- [ ] Kept localhost callback URL in Redirect URLs list
- [ ] Set `NEXT_PUBLIC_SITE_URL` environment variable in Vercel
- [ ] Redeployed the application
- [ ] Tested signup on production and verified email link


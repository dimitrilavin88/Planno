# Supabase Auth Redirect Configuration Guide

## Problem
Supabase Auth is sending confirmation links to `localhost:3000` instead of your deployed website URL.

## Solution

You need to configure redirect URLs in **two places**:

### 1. Supabase Dashboard Configuration

1. **Go to Supabase Dashboard:**
   - Navigate to your project at https://supabase.com/dashboard
   - Select your project

2. **Configure Site URL:**
   - Go to **Authentication** → **URL Configuration**
   - Set **Site URL** to your production domain:
     ```
     https://your-domain.vercel.app
     ```
     or
     ```
     https://your-custom-domain.com
     ```

3. **Add Redirect URLs:**
   - In the same **URL Configuration** section
   - Under **Redirect URLs**, add:
     ```
     https://your-domain.vercel.app/auth/callback
     https://your-custom-domain.com/auth/callback
     ```
   - Also keep localhost for development:
     ```
     http://localhost:3000/auth/callback
     ```

4. **Save Changes**

### 2. Environment Variables

Make sure you have the correct environment variables set:

#### In Vercel (Production):
1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add/Update:
   ```
   NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
   ```
   or
   ```
   NEXT_PUBLIC_SITE_URL=https://your-custom-domain.com
   ```

#### In Local Development (.env.local):
```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Code Updates (Already Done)

The code has been updated to:
- Use `NEXT_PUBLIC_SITE_URL` environment variable when available
- Fall back to `window.location.origin` for client-side (development)
- Fall back to `localhost:3000` as last resort

Files updated:
- `app/auth/signup/page.tsx` - Uses environment variable for email redirect
- `app/auth/login/page.tsx` - Uses environment variable for magic link redirect

## How It Works

1. **Signup Flow:**
   - User signs up → Code uses `NEXT_PUBLIC_SITE_URL` if set
   - Supabase sends confirmation email with redirect URL
   - User clicks link → Redirects to production URL

2. **Magic Link Flow:**
   - User requests magic link → Code uses `NEXT_PUBLIC_SITE_URL` if set
   - Supabase sends email with redirect URL
   - User clicks link → Redirects to production URL

## Verification Steps

1. **Check Supabase Dashboard:**
   - Authentication → URL Configuration
   - Verify Site URL is your production domain
   - Verify Redirect URLs include your production callback URL

2. **Check Vercel Environment Variables:**
   - Settings → Environment Variables
   - Verify `NEXT_PUBLIC_SITE_URL` is set to production URL

3. **Test:**
   - Sign up a new user on production
   - Check the confirmation email
   - Verify the link points to your production domain, not localhost

## Important Notes

- **Site URL** in Supabase is used as the base for constructing email links
- **Redirect URLs** must include all URLs where users can be redirected after auth
- Always include both production and localhost URLs in Redirect URLs list
- The `NEXT_PUBLIC_SITE_URL` environment variable takes precedence over `window.location.origin`

## Troubleshooting

**Issue:** Links still go to localhost
- **Solution:** 
  1. Check Supabase Dashboard → Authentication → URL Configuration
  2. Verify Site URL is production domain
  3. Verify `NEXT_PUBLIC_SITE_URL` is set in Vercel
  4. Redeploy after changing environment variables

**Issue:** "Invalid redirect URL" error
- **Solution:** Add the exact redirect URL to Supabase Dashboard → Authentication → Redirect URLs

**Issue:** Works locally but not in production
- **Solution:** 
  1. Verify `NEXT_PUBLIC_SITE_URL` is set in Vercel (not just locally)
  2. Redeploy after adding the environment variable
  3. Check Supabase Site URL matches your production domain


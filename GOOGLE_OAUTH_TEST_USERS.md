# How to Add Test Users for Google OAuth

## Problem
You're seeing: "Planno has not completed the Google verification process. The app is currently being tested, and can only be accessed by developer-approved testers."

## Solution: Add Yourself as a Test User

### Step-by-Step Instructions

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Select your project

2. **Navigate to OAuth Consent Screen**
   - Click on **APIs & Services** in the left sidebar
   - Click on **OAuth consent screen**

3. **Find the Test Users Section**
   - Scroll down to the **Test users** section
   - You'll see a list of current test users (probably empty)

4. **Add Your Email**
   - Click the **+ ADD USERS** button
   - Enter your email address (the one you use to sign in to Planno)
     - Example: `dimitrilavin@gmail.com`
   - Click **ADD**

5. **Wait for Changes to Propagate**
   - Google may take a few minutes to update
   - Try the OAuth flow again after 2-3 minutes

6. **Try Again**
   - Go back to `/dashboard/calendar`
   - Click "Connect" for Google Calendar
   - You should now be able to authorize the app

## Adding Multiple Test Users

If you need to test with multiple accounts:
- Add each email address separately
- Each user must be added individually
- There's no limit on the number of test users

## Important Notes

- **Test users only:** While your app is in "Testing" mode, ONLY the emails you add can use OAuth
- **Email must match exactly:** The email you add must match the Google account you're using
- **Changes take time:** Sometimes it takes 5-10 minutes for changes to take effect
- **Clear cache:** If it still doesn't work, try:
  - Incognito/private browsing mode
  - Clear browser cookies for `accounts.google.com`
  - Wait a few more minutes

## Making Your App Public (Advanced)

If you want anyone to be able to use your app without adding them as test users:

1. Go to **OAuth consent screen**
2. Change **Publishing status** from **Testing** to **In production**
3. **Warning:** This may require app verification if you use sensitive scopes
4. For production apps, Google may require verification which can take weeks

**Recommendation:** Keep it in Testing mode and add test users until you're ready for production.


# Complete Mailgun Setup Guide for Planno

This guide will walk you through setting up Mailgun to send:

1. **Confirmation emails** when guests schedule meetings
2. **Reminder emails** before upcoming meetings

## Prerequisites

- A Supabase project
- A Mailgun account (free tier includes 5,000 emails/month for 3 months)
- Supabase CLI installed (for deploying Edge Functions)

---

## Step 1: Set Up Mailgun Account

### 1.1 Create Account

1. Go to https://www.mailgun.com
2. Sign up for a free account
3. Verify your email address

### 1.2 Verify Your Domain

**Option A: Use Your Own Domain (Recommended for Production)**

1. In Mailgun dashboard, go to **Sending > Domains**
2. Click **Add New Domain**
3. Choose **Add Domain** (not subdomain)
4. Enter your domain (e.g., `yourdomain.com`)
5. Follow the DNS setup instructions:
   - Add the provided DNS records (MX, TXT, CNAME) to your domain's DNS settings
   - Wait for DNS propagation (can take up to 48 hours, usually much faster)
6. Once verified, you'll see a green checkmark
7. **Copy the domain name** - you'll need this for `MAILGUN_DOMAIN`

**Option B: Use Sandbox Domain (For Testing)**

1. In Mailgun dashboard, go to **Sending > Domains**
2. You'll see a sandbox domain like `sandbox123456.mailgun.org`
3. **Note:** With sandbox domain, you must verify recipient email addresses first
4. Go to **Sending > Authorized Recipients** and add test email addresses

### 1.3 Get Your API Key

1. In Mailgun dashboard, go to **Settings > API Keys**
2. Find the **Private API key** (starts with `key-`)
3. Click **Reveal** to see the full key
4. **Copy the entire key** - you'll need this for `MAILGUN_API_KEY`

---

## Step 2: Deploy Supabase Edge Functions

### 2.1 Install Supabase CLI

**For macOS (using Homebrew):**

```bash
brew install supabase/tap/supabase
```

**For other platforms, see:** https://github.com/supabase/cli#install-the-cli

**Note:** `npm install -g supabase` is no longer supported. Use the official installation methods instead.

### 2.2 Login and Link Your Project

```bash
# Login to Supabase
supabase login

# Link your project (get project-ref from Supabase Dashboard > Settings > General)
supabase link --project-ref your-project-ref
```

### 2.3 Deploy the Email Functions

```bash
# Deploy booking confirmation email function
supabase functions deploy send-booking-email

# Deploy reminder email function
supabase functions deploy send-reminder-email
```

---

## Step 3: Set Environment Variables in Supabase

1. Go to **Supabase Dashboard > Project Settings > Edge Functions**
2. Scroll to **Environment Variables** section
3. Click **Add new secret** for each variable below:

### Variable 1: MAILGUN_API_KEY

- **Name:** `MAILGUN_API_KEY`
- **Value:** Your Private API key from Mailgun (from Step 1.3)
- Example: `key-1234567890abcdef1234567890abcdef-12345678-90ab-cdef-1234-567890abcdef`

### Variable 2: MAILGUN_DOMAIN

- **Name:** `MAILGUN_DOMAIN`
- **Value:** Your verified domain from Mailgun
- Examples:
  - Production: `mg.yourdomain.com` or `yourdomain.com`
  - Testing: `sandbox123456.mailgun.org`

### Variable 3: MAILGUN_FROM_EMAIL

- **Name:** `MAILGUN_FROM_EMAIL`
- **Value:** An email address using your verified domain
- Examples:
  - `noreply@yourdomain.com`
  - `notifications@yourdomain.com`
- **Important:** Must use your verified domain (not a random email)

### Variable 4: REMINDER_HOURS_BEFORE (Optional)

- **Name:** `REMINDER_HOURS_BEFORE`
- **Value:** `24` (or whatever number of hours you want)
- Defaults to 24 hours if not set

### Variable 5: NEXT_PUBLIC_SITE_URL (If not already set)

- **Name:** `NEXT_PUBLIC_SITE_URL`
- **Value:** Your production URL (e.g., `https://your-app.vercel.app`)
- Used in email templates for links

---

## Step 4: Set Up Database Webhook for Booking Emails

This will automatically send confirmation emails when meetings are created.

1. Go to **Supabase Dashboard > Database > Webhooks**
2. Click **Create a new webhook**
3. Configure as follows:

   **Basic Information:**

   - **Name:** `Send Booking Email`
   - **Table:** `meetings`
   - **Events:** Select `INSERT` only

   **Webhook Details:**

   - **Type:** HTTP Request
   - **Method:** POST
   - **URL:** `https://your-project-ref.supabase.co/functions/v1/send-booking-email`
     - Replace `your-project-ref` with your actual Supabase project reference
     - Find it in: Settings > General > Reference ID

   **HTTP Headers:**

   - Click **Add header**
   - **Key:** `Authorization`
   - **Value:** `Bearer YOUR_SERVICE_ROLE_KEY`
     - Get this from: Settings > API > service_role key (secret)

   **HTTP Request Body:**

   ```json
   {
     "meeting_id": "{{ $1.id }}"
   }
   ```

   - This passes the newly created meeting's ID to the function

4. Click **Save**

**Test the Webhook:**

- Create a test meeting through your app
- Check Mailgun dashboard > **Sending > Logs** to see if email was sent
- Check the recipient's inbox (and spam folder)

---

## Step 5: Set Up Reminder Email Scheduling

You need to set up a scheduled job to send reminder emails. Here are two options:

### Option A: Using Supabase Cron (Recommended)

1. Go to **Supabase Dashboard > Database > Cron Jobs**
2. Click **Create a new cron job**
3. Configure:

   **Basic Information:**

   - **Name:** `Send Reminder Emails`
   - **Schedule:** `0 * * * *` (runs every hour at minute 0)
     - Or use `0 */6 * * *` for every 6 hours
     - Or use `0 9 * * *` for daily at 9 AM

   **SQL Command:**

   ```sql
   SELECT
     net.http_post(
       url := 'https://your-project-ref.supabase.co/functions/v1/send-reminder-email',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
       ),
       body := '{}'::jsonb
     ) AS request_id;
   ```

   - Replace `your-project-ref` with your Supabase project reference
   - Replace `YOUR_SERVICE_ROLE_KEY` with your service role key

4. Click **Save**

**Note:** If `net.http_post` is not available, you may need to enable the `pg_net` extension first:

```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### Option B: External Scheduler (Vercel Cron, GitHub Actions, etc.)

If Supabase Cron is not available, use an external scheduler:

**Vercel Cron (if deployed on Vercel):**

1. Create `vercel.json` in your project root:

```json
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "0 * * * *"
    }
  ]
}
```

2. Create `app/api/cron/reminders/route.ts`:

```typescript
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const response = await fetch(
    `${supabaseUrl}/functions/v1/send-reminder-email`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({}),
    }
  );

  const data = await response.json();
  return NextResponse.json(data);
}
```

3. Set `CRON_SECRET` in Vercel environment variables
4. Set `SUPABASE_SERVICE_ROLE_KEY` in Vercel environment variables

**GitHub Actions (Alternative):**
Create `.github/workflows/send-reminders.yml`:

```yaml
name: Send Reminder Emails
on:
  schedule:
    - cron: "0 * * * *" # Every hour
  workflow_dispatch: # Allow manual trigger

jobs:
  send-reminders:
    runs-on: ubuntu-latest
    steps:
      - name: Call Reminder Function
        run: |
          curl -X POST \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            https://your-project-ref.supabase.co/functions/v1/send-reminder-email \
            -d '{}'
```

---

## Step 6: Test the Integration

### Test Booking Confirmation Email

1. **Create a test meeting:**

   - Go to your app
   - Have a guest schedule a meeting
   - Or create a meeting through the dashboard

2. **Check Mailgun logs:**

   - Go to Mailgun dashboard > **Sending > Logs**
   - You should see the email was sent

3. **Check recipient inbox:**
   - Look for the confirmation email
   - Check spam folder if not in inbox

### Test Reminder Email

1. **Create a test meeting:**

   - Schedule a meeting for 24 hours from now (or your `REMINDER_HOURS_BEFORE` setting)

2. **Trigger reminder manually (for testing):**

   ```bash
   curl -X POST \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
     https://your-project-ref.supabase.co/functions/v1/send-reminder-email \
     -d '{"meeting_id": "your-meeting-id"}'
   ```

3. **Or wait for the cron job** to run

4. **Check Mailgun logs and recipient inbox**

---

## Troubleshooting

### Emails Not Sending

1. **Check Mailgun Logs:**

   - Go to Mailgun dashboard > **Sending > Logs**
   - Look for error messages
   - Common errors:
     - "Domain not verified" → Check DNS records
     - "Unauthorized" → Check API key
     - "Invalid from address" → Check `MAILGUN_FROM_EMAIL` uses verified domain

2. **Check Edge Function Logs:**

   - Go to Supabase Dashboard > **Edge Functions > send-booking-email > Logs**
   - Look for error messages
   - Check if environment variables are set correctly

3. **Verify Environment Variables:**

   - Go to Supabase Dashboard > **Project Settings > Edge Functions**
   - Ensure all Mailgun variables are set
   - Check that values are correct (no extra spaces)

4. **Check Webhook Configuration:**
   - Go to Supabase Dashboard > **Database > Webhooks**
   - Verify webhook URL is correct
   - Ensure Authorization header includes service role key
   - Check that webhook is triggered on INSERT

### Common Issues

- **"Domain not verified"**:

  - Make sure DNS records are properly set in your domain registrar
  - Wait for DNS propagation (can take up to 48 hours)
  - Use Mailgun's domain verification tool to check status

- **"Unauthorized"**:

  - Verify your API key is correct
  - Make sure you're using the Private API key, not the Public validation key

- **"Invalid from address"**:

  - Ensure `MAILGUN_FROM_EMAIL` uses your verified domain
  - Example: If domain is `mg.yourdomain.com`, use `noreply@mg.yourdomain.com`

- **Emails going to spam**:

  - Set up SPF, DKIM, and DMARC records in Mailgun
  - Mailgun provides these in the domain setup instructions
  - Warm up your domain by sending emails gradually

- **Webhook not triggering**:
  - Check that webhook is enabled
  - Verify the table name is `meetings` (case-sensitive)
  - Ensure the event is `INSERT`
  - Check webhook logs in Supabase Dashboard

---

## Email Templates

The current implementation includes beautiful HTML email templates:

### Confirmation Email

- Sent to host and all guests when a meeting is created
- Includes:
  - Meeting title
  - Date and time (formatted with timezone)
  - Duration
  - Location
  - Participant names

### Reminder Email

- Sent to all participants X hours before the meeting
- Includes:
  - Meeting title
  - Date and time
  - Duration
  - Location
  - Hours until meeting

Both templates use professional styling with:

- Navy blue header (matching your app theme)
- Clean, readable layout
- Responsive design

---

## Next Steps

- **Customize email templates**: Edit the HTML in `supabase/functions/send-booking-email/index.ts` and `send-reminder-email/index.ts`
- **Add calendar invites**: Generate .ics files and attach them to emails
- **Set up different reminder times**: Allow users to configure reminder preferences
- **Add email preferences**: Let users opt-in/out of different email types
- **Track email analytics**: Use Mailgun's analytics to track opens and clicks

---

## Support Resources

- **Mailgun Documentation**: https://documentation.mailgun.com/
- **Mailgun Support**: https://www.mailgun.com/support/
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions
- **Supabase Webhooks**: https://supabase.com/docs/guides/database/webhooks

---

## Quick Reference

**Environment Variables Needed:**

- `MAILGUN_API_KEY` - From Mailgun Settings > API Keys
- `MAILGUN_DOMAIN` - From Mailgun Sending > Domains
- `MAILGUN_FROM_EMAIL` - Email using your verified domain
- `REMINDER_HOURS_BEFORE` - Hours before meeting (default: 24)
- `NEXT_PUBLIC_SITE_URL` - Your production URL

**Webhook URL:**

- `https://your-project-ref.supabase.co/functions/v1/send-booking-email`

**Reminder Function URL:**

- `https://your-project-ref.supabase.co/functions/v1/send-reminder-email`

**Service Role Key:**

- Found in: Supabase Dashboard > Settings > API > service_role key (secret)

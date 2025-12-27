# Mailgun Integration Setup Guide

This guide will help you set up Mailgun for sending automated confirmation and reminder emails in Planno.

## Step 1: Create Mailgun Account

1. Go to https://www.mailgun.com
2. Sign up for a free account (includes 5,000 emails/month for 3 months)
3. Verify your email address

## Step 2: Verify Your Domain

1. In Mailgun dashboard, go to **Sending > Domains** (or click **Sending** in the left sidebar, then **Domains**)
2. You'll see your domains listed here
3. If you haven't added a domain yet:
   - Click **Add New Domain**
   - Choose **Add Domain** (not subdomain)
   - Enter your domain (e.g., `yourdomain.com`)
   - Follow the DNS setup instructions:
     - Add the provided DNS records to your domain's DNS settings
     - Wait for DNS propagation (can take up to 48 hours, usually much faster)
4. Once verified, you'll see a green checkmark next to your domain
5. **Copy the domain name** - this is what you'll use for `MAILGUN_DOMAIN`
   - It might be just `yourdomain.com` or `mg.yourdomain.com` depending on your setup

**Note:** For testing, you can use Mailgun's sandbox domain (e.g., `sandbox123456.mailgun.org`), but you'll need to verify recipient addresses first. The sandbox domain will be listed in the Domains section.

## Step 3: Get Your API Key

1. In Mailgun dashboard, go to **Settings > API Keys** (or click your profile icon → Settings → API Keys)
2. You'll see two keys:
   - **Public validation key** - Used for email validation (not needed here)
   - **Private API key** - This is what you need (starts with `key-`)
3. Click **Reveal** next to the Private API key to see it
4. Copy the entire key (it will look like: `key-1234567890abcdef1234567890abcdef-12345678-90ab-cdef-1234-567890abcdef`)
5. Keep this secure - you'll need it for the Edge Function

**Note:** If you don't see the API keys section, make sure you're logged into the correct Mailgun account and have the right permissions.

## Step 4: Set Up Supabase Edge Functions

### 4.1. Set Environment Variables

1. Go to your Supabase Dashboard
2. Navigate to **Project Settings > Edge Functions** (or **Settings** → **Edge Functions**)
3. Scroll down to the **Environment Variables** section
4. Click **Add new secret** for each variable
5. Add the following environment variables:

**Variable 1: MAILGUN_API_KEY**
- **Name:** `MAILGUN_API_KEY`
- **Value:** Your Private API key from Mailgun (from Step 3)
- Example: `key-1234567890abcdef1234567890abcdef-12345678-90ab-cdef-1234-567890abcdef`

**Variable 2: MAILGUN_DOMAIN**
- **Name:** `MAILGUN_DOMAIN`
- **Value:** Your verified domain from Mailgun (from Step 2)
- Example: `mg.yourdomain.com` or `yourdomain.com` or `sandbox123456.mailgun.org` (for testing)

**Variable 3: MAILGUN_FROM_EMAIL**
- **Name:** `MAILGUN_FROM_EMAIL`
- **Value:** An email address from your verified domain
- Example: `noreply@yourdomain.com` or `notifications@yourdomain.com`
- **Important:** Must use your verified domain (not a random email)

**Variable 4: REMINDER_HOURS_BEFORE** (Optional)
- **Name:** `REMINDER_HOURS_BEFORE`
- **Value:** `24` (or whatever number of hours you want)
- This is optional - defaults to 24 if not set

**Where to find these values:**
- **MAILGUN_API_KEY:** Mailgun Dashboard → Settings → API Keys → Private API key
- **MAILGUN_DOMAIN:** Mailgun Dashboard → Sending → Domains → Your verified domain name
- **MAILGUN_FROM_EMAIL:** Any email address using your verified domain (you create this)

### 4.2. Deploy Edge Functions

```bash
# Install Supabase CLI if you haven't already
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy the email functions
supabase functions deploy send-booking-email
supabase functions deploy send-reminder-email
```

## Step 5: Set Up Database Webhooks

### 5.1. Create Webhook for Booking Emails

1. Go to **Supabase Dashboard > Database > Webhooks**
2. Click **Create a new webhook**
3. Configure:
   - **Name:** `Send Booking Email`
   - **Table:** `meetings`
   - **Events:** Select `INSERT`
   - **Type:** HTTP Request
   - **URL:** `https://your-project-ref.supabase.co/functions/v1/send-booking-email`
   - **HTTP Method:** POST
   - **HTTP Headers:**
     - Key: `Authorization`
     - Value: `Bearer YOUR_SERVICE_ROLE_KEY` (get this from Settings > API)
   - **HTTP Request Body:**
     ```json
     {
       "meeting_id": "{{ $1.id }}"
     }
     ```
4. Click **Save**

### 5.2. Set Up Reminder Email Scheduling

You have two options:

#### Option A: Using Supabase Cron (Recommended)

1. Go to **Supabase Dashboard > Database > Cron Jobs**
2. Create a new cron job:
   - **Name:** `Send Reminder Emails`
   - **Schedule:** `0 * * * *` (runs every hour)
   - **SQL:**
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

#### Option B: External Scheduler (GitHub Actions, Vercel Cron, etc.)

Create a scheduled job that calls:
```
POST https://your-project-ref.supabase.co/functions/v1/send-reminder-email
Headers:
  Authorization: Bearer YOUR_SERVICE_ROLE_KEY
Body: {}
```

## Step 6: Test the Integration

### Test Booking Email

1. Create a test meeting through your app
2. Check the Mailgun dashboard > **Sending > Logs** to see if emails were sent
3. Check the recipient's inbox (and spam folder)

### Test Reminder Email

1. Create a meeting scheduled for 24 hours from now
2. Wait for the cron job to run (or trigger it manually)
3. Check Mailgun logs and recipient inbox

## Troubleshooting

### Emails Not Sending

1. **Check Mailgun Logs:**
   - Go to Mailgun dashboard > **Sending > Logs**
   - Look for error messages

2. **Check Edge Function Logs:**
   - Go to Supabase Dashboard > **Edge Functions > send-booking-email > Logs**
   - Look for error messages

3. **Verify Environment Variables:**
   - Ensure all Mailgun variables are set correctly
   - Check that API key is correct
   - Verify domain is verified in Mailgun

4. **Check Webhook Configuration:**
   - Verify webhook URL is correct
   - Ensure Authorization header includes service role key
   - Check that webhook is triggered on INSERT

### Common Issues

- **"Domain not verified"**: Make sure DNS records are properly set and propagated
- **"Unauthorized"**: Check that your API key is correct
- **"Invalid from address"**: Ensure `MAILGUN_FROM_EMAIL` uses your verified domain
- **Emails going to spam**: Set up SPF, DKIM, and DMARC records in Mailgun

## Email Templates

The current implementation includes:
- **Confirmation emails**: Sent when a meeting is created
- **Reminder emails**: Sent X hours before a meeting (default: 24 hours)

Both use beautiful HTML templates with:
- Meeting title
- Date and time (formatted with timezone)
- Duration
- Location
- Participant names

## Next Steps

- Customize email templates in the Edge Functions
- Add calendar invite attachments (.ics files)
- Set up different reminder times for different event types
- Add email preferences for users
- Track email opens and clicks (Mailgun provides analytics)

## Support

- Mailgun Documentation: https://documentation.mailgun.com/
- Mailgun Support: https://www.mailgun.com/support/
- Supabase Edge Functions: https://supabase.com/docs/guides/functions


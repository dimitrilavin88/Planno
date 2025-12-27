# Planno - Scheduling Web Application

A comprehensive, production-ready scheduling web application built with Next.js 14, TypeScript, Tailwind CSS, and Supabase. Planno enables users to manage their availability, create event types, and allow others to book meetings through public booking links.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Database Setup](#database-setup)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Security](#security)
- [What's Completed](#whats-completed)
- [What Needs to Be Completed](#what-needs-to-be-completed)
- [Troubleshooting](#troubleshooting)

## Features

### ✅ Completed Features

#### Authentication & User Management
- Email/password signup and login
- Magic link (OTP) authentication
- Session management with middleware
- Protected routes with `requireAuth()`
- User profile setup with unique usernames
- Timezone management
- Public scheduling pages at `/[username]`

#### Availability Management
- Weekly availability management (CRUD operations)
- Multiple time windows per day
- Timezone-aware availability calculations
- Visual availability editor

#### Event Types
- Create and manage event types
- Custom durations, locations, and buffers
- Minimum notice requirements
- Daily booking limits
- Unique booking links per event type
- Support for in-person, phone, video, and custom locations

#### Booking System
- Public booking pages at `/book/[bookingLink]`
- Date and time slot selection
- Automatic timezone detection and conversion
- Participant information form
- Booking confirmation page
- Atomic booking with time slot locking (prevents double-booking)
- Availability calculation that considers:
  - Weekly availability rules
  - Existing meetings
  - Buffers and notice periods
  - Daily booking limits

#### Meeting Management
- Meeting rescheduling with availability validation
- Meeting cancellation
- Secure reschedule/cancel links
- Meetings list view (upcoming & past)
- Meeting status tracking

#### Group Scheduling
- Group event types creation and management
- Multiple hosts per group event
- Overlapping availability calculation
- Group meeting booking
- Group booking UI at `/book-group/[bookingLink]`
- Group event types dashboard

#### Dashboard
- Main dashboard with navigation
- Availability management page
- Event types management page
- Group event types management page
- Meetings list page
- Public scheduling link display

### ⚠️ Partially Implemented

#### Edge Functions & Integrations
- Edge Functions structure created
- Calendar integrations (Google/Outlook) - Structure ready, needs API integration
- Email service integration - Structure ready, needs service integration

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Supabase
  - PostgreSQL database
  - Supabase Auth
  - Row Level Security (RLS)
  - Edge Functions
- **Hosting**: Vercel (frontend), Supabase (backend)

## Project Structure

```
Planno/
├── app/                          # Next.js App Router pages
│   ├── [username]/              # Public user scheduling pages
│   ├── auth/                    # Authentication pages
│   │   ├── login/               # Login page
│   │   ├── signup/              # Signup page
│   │   ├── callback/            # OAuth callback handler
│   │   └── logout/              # Logout route
│   ├── book/                    # Single host booking
│   │   └── [bookingLink]/      # Public booking page
│   ├── book-group/              # Group booking
│   │   └── [bookingLink]/      # Group booking page
│   ├── booking/                 # Booking confirmation
│   │   └── confirmed/           # Confirmation page
│   ├── dashboard/               # Protected dashboard pages
│   │   ├── availability/        # Availability management
│   │   ├── event-types/         # Event types management
│   │   ├── group-event-types/   # Group event types
│   │   └── meetings/            # Meetings list
│   ├── meeting/                 # Meeting management
│   │   └── [meetingId]/
│   │       ├── reschedule/      # Reschedule page
│   │       └── cancel/          # Cancel page
│   ├── profile/                 # Profile management
│   │   └── setup/               # Profile setup
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Home page
│   └── globals.css              # Global styles
├── components/                   # React components
│   ├── auth/                    # Auth components
│   │   └── logout-button.tsx
│   ├── availability/            # Availability management
│   │   └── availability-manager.tsx
│   ├── booking/                 # Booking flow
│   │   ├── booking-flow.tsx
│   │   └── group-booking-flow.tsx
│   ├── event-types/             # Event type management
│   │   └── event-types-manager.tsx
│   ├── group-event-types/       # Group event types
│   │   └── group-event-types-manager.tsx
│   ├── meeting/                 # Meeting management
│   │   ├── cancel-meeting.tsx
│   │   └── reschedule-meeting.tsx
│   ├── meetings/                # Meeting list
│   │   └── meetings-list.tsx
│   └── copy-button.tsx          # Utility component
├── lib/                         # Utilities
│   ├── supabase/                # Supabase clients
│   │   ├── client.ts            # Browser client
│   │   └── server.ts            # Server client
│   └── auth/                    # Auth utilities
│       └── utils.ts             # requireAuth, getAuthUser
├── supabase/                    # Database files
│   ├── schema.sql               # Complete database schema
│   ├── rls.sql                  # Row Level Security policies
│   └── functions/               # RPC functions & Edge Functions
│       ├── create_user_profile.sql
│       ├── update_username.sql
│       ├── calculate_availability.sql
│       ├── calculate_group_availability.sql
│       ├── book_meeting.sql
│       ├── book_group_meeting.sql
│       ├── lock_time_slot.sql
│       ├── reschedule_meeting.sql
│       ├── cancel_meeting.sql
│       ├── trigger-meeting-webhooks.sql
│       ├── create-calendar-event/  # Edge Function (needs implementation)
│       │   └── index.ts
│       └── send-booking-email/     # Edge Function (needs implementation)
│           └── index.ts
├── middleware.ts                # Auth middleware
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- A Supabase account and project
- (Optional) Vercel account for deployment

### Installation

1. **Clone the repository** (if applicable) or navigate to the project directory

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables** (see [Environment Variables](#environment-variables) section)

4. **Set up the database** (see [Database Setup](#database-setup) section)

5. **Run the development server:**
```bash
npm run dev
```

6. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Database Setup

### Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Create a new project
3. Note your project URL and anon key from **Settings > API**

### Step 2: Run SQL Files

Run these SQL files in your Supabase SQL Editor **in this exact order**:

1. **`supabase/schema.sql`** - Creates all tables, indexes, and triggers
2. **`supabase/rls.sql`** - Sets up Row Level Security policies
3. **`supabase/functions/create_user_profile.sql`** - Auto-creates user profiles on signup
4. **`supabase/functions/update_username.sql`** - Username update function with uniqueness check
5. **`supabase/functions/calculate_availability.sql`** - Availability calculation function
6. **`supabase/functions/calculate_group_availability.sql`** - Group availability calculation
7. **`supabase/functions/lock_time_slot.sql`** - Time slot locking mechanism
8. **`supabase/functions/book_meeting.sql`** - Atomic booking function
9. **`supabase/functions/book_group_meeting.sql`** - Group booking function
10. **`supabase/functions/reschedule_meeting.sql`** - Reschedule function
11. **`supabase/functions/cancel_meeting.sql`** - Cancel function
12. **`supabase/functions/trigger-meeting-webhooks.sql`** - Webhook triggers (for Edge Functions)

### Database Schema Overview

#### Core Tables
- **`users`** - User profiles with usernames and timezones
- **`event_types`** - Individual event types with booking rules
- **`availability_rules`** - Weekly availability windows
- **`meetings`** - Scheduled meetings
- **`meeting_participants`** - Meeting participants (supports group scheduling)
- **`calendars`** - Connected external calendars (Google, Outlook)
- **`booking_links`** - Secure booking links for event types
- **`time_slot_locks`** - Prevents double-booking (temporary locks)

#### Group Scheduling Tables
- **`group_event_types`** - Group event definitions
- **`group_event_type_hosts`** - Host relationships for group events

## Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Site URL (for redirects and links)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

For production, set these same variables in your hosting platform (Vercel, etc.) with your production domain.

### Edge Functions Environment Variables

Set these in **Supabase Dashboard > Project Settings > Edge Functions**:

```env
# Mailgun Configuration (Required for emails)
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_DOMAIN=your_mailgun_domain.com
MAILGUN_FROM_EMAIL=noreply@your_mailgun_domain.com

# Reminder Configuration (Optional)
REMINDER_HOURS_BEFORE=24
```

**Mailgun Setup:**
1. Sign up for Mailgun at https://www.mailgun.com
2. Verify your domain in Mailgun dashboard
3. Get your API key from Mailgun dashboard (Settings > API Keys)
4. Set the environment variables above in Supabase

## Deployment

### Deploy to Vercel

1. **Push your code to GitHub**

2. **Import project in Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository

3. **Add environment variables:**
   - In Vercel dashboard, go to **Settings > Environment Variables**
   - Add all variables from `.env.local`
   - Update `NEXT_PUBLIC_SITE_URL` to your production domain

4. **Deploy:**
   - Click "Deploy"
   - Vercel will automatically build and deploy your app

### Set Up Database Webhooks (For Edge Functions)

Once Edge Functions are implemented, set up webhooks:

1. Go to **Supabase Dashboard > Database > Webhooks**

2. **Create webhook for calendar events:**
   - URL: `https://your-project.supabase.co/functions/v1/create-calendar-event`
   - HTTP Method: POST
   - Headers: `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`
   - Body: `{"meeting_id": "{{ $1.id }}"}`

3. **Create webhook for emails:**
   - URL: `https://your-project.supabase.co/functions/v1/send-booking-email`
   - HTTP Method: POST
   - Headers: `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`
   - Body: `{"meeting_id": "{{ $1.id }}"}`

4. **Set up reminder email scheduling (optional):**
   - Use Supabase Cron Jobs or external scheduler (e.g., GitHub Actions, Vercel Cron)
   - Call `https://your-project.supabase.co/functions/v1/send-reminder-email` periodically (e.g., every hour)
   - Or use Supabase Database Webhooks with a scheduled trigger

### Deploy Edge Functions

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref your-project-ref

# Deploy functions
supabase functions deploy create-calendar-event
supabase functions deploy send-booking-email
supabase functions deploy send-reminder-email
```

### Production Checklist

- [ ] Environment variables set in production
- [ ] HTTPS enabled
- [ ] Domain configured
- [ ] Database backups enabled
- [ ] Error monitoring set up (Sentry, etc.)
- [ ] Analytics configured (optional)
- [ ] Rate limiting configured (optional)

## Security

### ✅ Implemented Security Measures

#### Row Level Security (RLS)
- RLS enabled on all tables
- Users can only access their own data
- Public can read booking links and active event types
- No direct INSERT policies on meetings (must use RPC functions)

#### Authentication & Authorization
- Supabase Auth for user authentication
- Session management via middleware
- Protected routes with `requireAuth()`
- Secure token handling

#### Database Functions
- RPC functions use `SECURITY DEFINER` appropriately
- Input validation in all functions
- Transactional operations prevent race conditions
- Time slot locking prevents double-booking

#### Data Validation
- Database constraints (CHECK, FOREIGN KEY, UNIQUE)
- Username format validation
- Time range validation
- Status enum constraints

#### SQL Injection Prevention
- Parameterized queries (Supabase handles this)
- RPC functions use parameters, not string concatenation
- No raw SQL with user input

#### XSS Prevention
- React automatically escapes content
- User-generated content is sanitized through React

### ⚠️ Security Recommendations

1. **Edge Functions:**
   - Add rate limiting
   - Validate webhook requests
   - Secure API keys in environment variables

2. **Email & Calendar Integrations:**
   - Encrypt OAuth tokens in database
   - Use secure storage for access tokens
   - Implement token refresh logic

3. **Secure Links:**
   - Make reschedule/cancel tokens cryptographically secure
   - Add token expiration
   - Consider implementing token verification in RPC functions

4. **Rate Limiting:**
   - Add rate limiting to booking endpoints
   - Prevent abuse of availability calculation
   - Consider using Supabase rate limiting features

5. **Additional Measures:**
   - Add Content Security Policy (CSP) headers
   - Enforce HTTPS in production
   - Set secure cookie flags
   - Set up audit logging
   - Monitor for suspicious activity

## What's Completed

### Core Infrastructure ✅
- Next.js 14 App Router with TypeScript
- Tailwind CSS styling
- Supabase client setup (browser & server)
- Authentication middleware
- Row Level Security (RLS) on all tables
- Complete database schema with 11 tables

### Authentication & Users ✅
- Email/password signup and login
- Magic link authentication
- Session management
- Protected routes
- User profile setup with unique usernames
- Timezone management
- Public scheduling pages at `/[username]`

### Availability & Event Types ✅
- Weekly availability management (CRUD)
- Multiple time windows per day
- Event types creation and management
- Custom durations, locations, buffers
- Minimum notice requirements
- Daily booking limits
- Unique booking links per event type

### Booking System ✅
- Availability calculation RPC function
- Atomic booking RPC function with time slot locking
- Public booking pages
- Date and time slot selection
- Timezone detection and conversion
- Participant information form
- Booking confirmation page

### Meeting Management ✅
- Meeting rescheduling with availability validation
- Meeting cancellation
- Secure reschedule/cancel links
- Meetings list view (upcoming & past)

### Group Scheduling ✅
- Group event types creation and management
- Multiple hosts per group event
- Overlapping availability calculation
- Group meeting booking
- Group booking UI
- Group event types dashboard

### Dashboard ✅
- Main dashboard with navigation
- Availability management page
- Event types management page
- Group event types management page
- Meetings list page
- Public scheduling link display

## What Needs to Be Completed

### 1. Edge Functions Implementation ⚠️

The Edge Functions structure is in place, but the actual integrations need to be implemented:

#### `create-calendar-event` Function
**Location:** `supabase/functions/create-calendar-event/index.ts`

**What needs to be done:**
- Integrate Google Calendar API
  - OAuth flow for Google Calendar
  - Create calendar events via Google Calendar API
  - Handle event updates and deletions
- Integrate Outlook Calendar API
  - OAuth flow for Outlook Calendar
  - Create calendar events via Microsoft Graph API
  - Handle event updates and deletions
- Store calendar event IDs in the `meetings` table
- Handle errors and retries

**Required Environment Variables:**
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `OUTLOOK_CLIENT_ID`
- `OUTLOOK_CLIENT_SECRET`

#### `send-booking-email` Function
**Location:** `supabase/functions/send-booking-email/index.ts`

**Status:** ✅ **IMPLEMENTED with Mailgun**

**Features:**
- ✅ Sends confirmation emails to host and all guests when a meeting is created
- ✅ Beautiful HTML email templates
- ✅ Includes meeting details (date, time, duration, location)
- ✅ Handles multiple participants
- ✅ Error handling and reporting

**Required Environment Variables:**
- `MAILGUN_API_KEY` - Your Mailgun API key
- `MAILGUN_DOMAIN` - Your verified Mailgun domain
- `MAILGUN_FROM_EMAIL` - Sender email address (defaults to `noreply@your_domain.com`)

**Setup Instructions:**
1. Sign up for Mailgun at https://www.mailgun.com
2. Verify your domain in Mailgun dashboard
3. Get your API key from Mailgun dashboard
4. Set environment variables in Supabase Dashboard > Project Settings > Edge Functions

#### `send-reminder-email` Function
**Location:** `supabase/functions/send-reminder-email/index.ts`

**Status:** ✅ **IMPLEMENTED with Mailgun**

**Features:**
- ✅ Sends reminder emails to all meeting participants
- ✅ Configurable reminder time (default: 24 hours before)
- ✅ Can be called for specific meetings or run as scheduled job
- ✅ Beautiful HTML email templates

**Required Environment Variables:**
- `MAILGUN_API_KEY` - Your Mailgun API key
- `MAILGUN_DOMAIN` - Your verified Mailgun domain
- `MAILGUN_FROM_EMAIL` - Sender email address
- `REMINDER_HOURS_BEFORE` - Hours before meeting to send reminder (default: 24)

**Setup Instructions:**
1. Deploy the function: `supabase functions deploy send-reminder-email`
2. Set up a scheduled job (cron) to call this function periodically
3. Or call it manually for specific meetings via API

### 2. Calendar Sync (Optional Enhancement)

Currently, the system can create calendar events, but doesn't sync busy times from external calendars. To implement:

- Add OAuth flow for connecting calendars
- Store OAuth tokens securely in `calendars` table
- Implement calendar sync to fetch busy times
- Update availability calculation to exclude busy times from external calendars
- Handle token refresh

### 3. Additional Enhancements (Optional)

- **Reminder Emails:** Send reminder emails before meetings
- **Analytics:** Track booking metrics, popular time slots, etc.
- **Mobile App:** React Native or mobile web optimization
- **Recurring Meetings:** Support for recurring event types
- **Waitlist:** Allow users to join a waitlist for fully booked slots
- **Custom Branding:** Allow users to customize booking page appearance
- **Payment Integration:** Accept payments for paid event types
- **Video Conferencing:** Auto-generate Zoom/Google Meet links

## Troubleshooting

### RLS Errors

**Problem:** Getting permission denied errors when accessing data.

**Solutions:**
- Verify all RLS policies are applied (run `supabase/rls.sql`)
- Check user authentication status
- Verify user ID matches in queries
- Check that RPC functions are being used for inserts (not direct table inserts)

### Booking Fails

**Problem:** Bookings are failing or showing conflicts.

**Solutions:**
- Check availability calculation function
- Verify event type is active
- Check for conflicts with existing meetings
- Verify timezone handling
- Check daily booking limits
- Ensure minimum notice requirements are met

### Edge Functions Not Working

**Problem:** Edge Functions not executing or returning errors.

**Solutions:**
- Verify webhooks are set up correctly in Supabase dashboard
- Check function logs in Supabase dashboard
- Verify environment variables are set
- Check function deployment status
- Verify service role key is correct in webhook headers

### Authentication Issues

**Problem:** Users can't log in or sessions expire.

**Solutions:**
- Check Supabase Auth settings
- Verify environment variables are correct
- Check middleware configuration
- Verify cookie settings
- Check Supabase project status

### Timezone Issues

**Problem:** Times showing incorrectly or availability calculations wrong.

**Solutions:**
- Verify user timezone is set correctly
- Check timezone conversion in availability calculation
- Ensure all times are stored in UTC
- Verify client-side timezone detection

## Key Features Highlights

- **No Double-Booking:** Atomic booking with time slot locking prevents race conditions
- **Timezone-Aware:** All calculations respect user timezones
- **Concurrent-Safe:** Prevents race conditions in booking
- **Secure:** RLS policies ensure data isolation
- **Scalable:** Built on Supabase infrastructure
- **User-Friendly:** Modern UI with Tailwind CSS

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Supabase documentation
3. Check Next.js documentation
4. Review the code comments in the codebase

## License

[Add your license here]

---

**Status:** ✅ Core functionality complete, ⚠️ Edge Functions need implementation

The application is ready for deployment after completing Edge Function integrations (calendar and email).

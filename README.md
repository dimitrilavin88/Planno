# Planno - Scheduling Web Application

A comprehensive, production-ready scheduling web application built with Next.js 14, TypeScript, Tailwind CSS, and Supabase. Planno enables users to manage their availability, create event types, allow others to book meetings through public booking links, and share dashboards with team members.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Database Setup](#database-setup)
- [Environment Variables](#environment-variables)
- [Third-Party Integrations](#third-party-integrations)
- [Deployment](#deployment)
- [How to Navigate the Application](#how-to-navigate-the-application)
- [Security](#security)
- [Troubleshooting](#troubleshooting)

## Features

### ✅ Core Features

#### Authentication & User Management
- Email/password signup and login
- Magic link (OTP) authentication
- Session management with middleware
- Protected routes with `requireAuth()`
- User profile setup with unique usernames
- Timezone management
- Public scheduling pages at `/[username]`
- Display names from auth metadata

#### Availability Management
- Weekly availability management (CRUD operations)
- Multiple time windows per day
- Timezone-aware availability calculations
- Visual availability editor
- Shared dashboard support (view/edit permissions)

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
- Calendar integration (Google Calendar sync)
- iCalendar (.ics) downloads for Apple Calendar

#### Group Scheduling
- Group event types creation and management
- Multiple hosts per group event
- Overlapping availability calculation
- Group meeting booking
- Group booking UI at `/book-group/[bookingLink]`
- Group event types dashboard

#### Calendar Integration
- **Google Calendar**: OAuth connection, automatic event creation/update/deletion
- **Apple Calendar**: iCalendar (.ics) file downloads
- Automatic sync when meetings are booked, rescheduled, or cancelled
- Calendar connection management in dashboard

#### Email Notifications
- **Booking Confirmation Emails**: Sent to host and guests when meetings are created
- **Reminder Emails**: Configurable reminder emails (default: 24 hours before)
- Beautiful HTML email templates via Mailgun

#### Dashboard Sharing
- Share dashboards with other users
- View-only and edit permissions
- Shared dashboard pages for viewing/managing shared content
- Display owner's meetings, availability, and event types

#### Dashboard
- Main dashboard with navigation
- Availability management page
- Event types management page
- Group event types management page
- Meetings list page
- Calendar integration settings
- Dashboard sharing management
- Public scheduling link display
- Connected calendar display with provider logos

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Supabase
  - PostgreSQL database
  - Supabase Auth
  - Row Level Security (RLS)
  - Edge Functions (Deno)
- **Email**: Mailgun
- **Calendar**: Google Calendar API
- **Hosting**: Vercel (frontend), Supabase (backend)

## Project Structure

```
Planno/
├── app/                          # Next.js App Router pages
│   ├── [username]/              # Public user scheduling pages
│   ├── auth/                    # Authentication pages
│   │   ├── login/               # Login page
│   │   ├── signup/              # Signup page
│   │   └── callback/            # OAuth callback handler
│   ├── book/                    # Single host booking
│   │   └── [bookingLink]/      # Public booking page
│   ├── book-group/              # Group booking
│   │   └── [bookingLink]/      # Group booking page
│   ├── booking/                 # Booking confirmation
│   │   └── confirmed/           # Confirmation page with calendar buttons
│   ├── dashboard/               # Protected dashboard pages
│   │   ├── availability/        # Availability management
│   │   ├── event-types/         # Event types management
│   │   ├── group-event-types/   # Group event types
│   │   ├── meetings/            # Meetings list
│   │   ├── calendar/            # Calendar integration settings
│   │   ├── sharing/             # Dashboard sharing management
│   │   └── shared/              # Shared dashboard views
│   │       └── [ownerId]/
│   │           ├── page.tsx     # Shared dashboard overview
│   │           ├── meetings/    # Shared meetings
│   │           ├── availability/ # Shared availability
│   │           └── event-types/  # Shared event types
│   ├── meeting/                 # Meeting management
│   │   └── [meetingId]/
│   │       ├── reschedule/      # Reschedule page
│   │       └── cancel/          # Cancel page
│   ├── profile/                 # Profile management
│   │   └── setup/               # Profile setup
│   ├── api/                     # API routes
│   │   └── calendar/            # Calendar integration endpoints
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Landing page
│   └── globals.css              # Global styles
├── components/                   # React components
│   ├── auth/                    # Auth components
│   ├── availability/            # Availability management
│   ├── booking/                 # Booking flow
│   ├── calendar/                # Calendar components
│   ├── dashboard-sharing/       # Dashboard sharing
│   ├── event-types/             # Event type management
│   ├── group-event-types/       # Group event types
│   ├── meeting/                 # Meeting management
│   ├── meetings/                # Meeting list
│   └── logo.tsx                 # Logo component
├── lib/                         # Utilities
│   ├── supabase/                # Supabase clients
│   ├── auth/                    # Auth utilities
│   └── dashboard-access/        # Dashboard sharing utilities
├── supabase/                    # Database files
│   ├── functions/               # SQL functions & Edge Functions
│   │   ├── *.sql                # PostgreSQL functions
│   │   ├── create-calendar-event/  # Google Calendar sync
│   │   ├── send-booking-email/     # Booking confirmation emails
│   │   └── send-reminder-email/    # Reminder emails
│   ├── schema.sql               # Database schema
│   └── rls.sql                  # Row Level Security policies
├── DASHBOARD_SHARING_SETUP.sql  # Dashboard sharing database setup
├── DASHBOARD_SHARING_RLS_POLICIES.sql  # Dashboard sharing RLS policies
├── DATABASE_SETUP_UPDATED_FIXED.sql  # Complete database setup (recommended)
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
- (Optional) Mailgun account for email notifications
- (Optional) Google Cloud Project for calendar integration

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

### Quick Setup (Recommended)

For a complete, all-in-one database setup, run:

1. **`DATABASE_SETUP_UPDATED_FIXED.sql`** in your Supabase SQL Editor
   - This file includes all tables, indexes, triggers, RLS policies, and functions
   - Run this once to set up the entire database

2. **`DASHBOARD_SHARING_SETUP.sql`** (if you want dashboard sharing)
   - Creates the `dashboard_shares` table and helper functions

3. **`DASHBOARD_SHARING_RLS_POLICIES.sql`** (if you want dashboard sharing)
   - Updates RLS policies to support dashboard sharing

### Manual Setup (Step-by-Step)

If you prefer to set up manually or troubleshoot, run these SQL files in order:

1. **Schema & Tables**: Run `supabase/schema.sql` (or use the consolidated file above)
2. **RLS Policies**: Run `supabase/rls.sql` 
3. **Functions**: Run all SQL files in `supabase/functions/` directory

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

#### Dashboard Sharing Tables
- **`dashboard_shares`** - Dashboard sharing relationships with permission levels

## Environment Variables

### Required Variables

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration (Required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Site URL (for redirects and links)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Optional Variables

```env
# Google Calendar Integration (Optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Vercel automatically provides this
VERCEL_URL=your-vercel-url (auto-provided)
```

### Production Environment Variables

In Vercel, set the same variables but with production values:
- `NEXT_PUBLIC_SITE_URL` should be your production domain (e.g., `https://your-app.vercel.app`)

## Third-Party Integrations

### Mailgun (Email Notifications)

Planno uses Mailgun to send booking confirmation and reminder emails.

#### Setup Steps

1. **Create Mailgun Account**
   - Sign up at https://www.mailgun.com
   - Verify your email address

2. **Verify Your Domain**
   - Go to Mailgun Dashboard → Sending → Domains
   - Add your domain and follow DNS setup instructions
   - Wait for DNS propagation (usually takes a few minutes to hours)

3. **Get API Key**
   - Go to Mailgun Dashboard → Settings → API Keys
   - Copy your Private API key (starts with `key-`)

4. **Set Edge Function Environment Variables**
   - Go to Supabase Dashboard → Project Settings → Edge Functions
   - Add these environment variables:
     - `MAILGUN_API_KEY`: Your Private API key
     - `MAILGUN_DOMAIN`: Your verified domain (e.g., `mg.yourdomain.com`)
     - `MAILGUN_FROM_EMAIL`: Sender email (e.g., `noreply@yourdomain.com`)
     - `REMINDER_HOURS_BEFORE`: Hours before meeting to send reminder (default: 24)

5. **Deploy Edge Functions**
```bash
supabase functions deploy send-booking-email
supabase functions deploy send-reminder-email
```

6. **Set Up Database Webhooks**
   - Go to Supabase Dashboard → Database → Webhooks
   - Create webhook for `meetings` table on INSERT
   - URL: `https://your-project.supabase.co/functions/v1/send-booking-email`
   - Method: POST
   - Headers: `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`
   - Body: `{"meeting_id": "{{ $1.id }}"}`

7. **Set Up Reminder Email Scheduling**
   - Use Supabase Cron Jobs or external scheduler
   - Call `https://your-project.supabase.co/functions/v1/send-reminder-email` periodically

### Google Calendar Integration

Planno integrates with Google Calendar to automatically sync meetings.

#### Setup Steps

1. **Create Google Cloud Project**
   - Go to https://console.cloud.google.com/
   - Create a new project or select existing

2. **Enable Google Calendar API**
   - Navigate to APIs & Services → Library
   - Search for "Google Calendar API"
   - Click Enable

3. **Create OAuth 2.0 Credentials**
   - Go to APIs & Services → Credentials
   - Click Create Credentials → OAuth client ID
   - Configure OAuth consent screen:
     - Choose "External" (unless you have Google Workspace)
     - Fill in required fields
     - Add scopes: `https://www.googleapis.com/auth/calendar.events`
   - Create OAuth 2.0 Client ID:
     - Application type: Web application
     - Authorized redirect URIs:
       - Development: `http://localhost:3000/api/calendar/google/callback`
       - Production: `https://your-domain.vercel.app/api/calendar/google/callback`

4. **Add Test Users** (for development)
   - In OAuth consent screen, add test users
   - Only test users can use the app until it's verified

5. **Set Environment Variables**
   - Add to Vercel and `.env.local`:
     ```env
     GOOGLE_CLIENT_ID=your_google_client_id
     GOOGLE_CLIENT_SECRET=your_google_client_secret
     ```

6. **Deploy Edge Function**
```bash
supabase functions deploy create-calendar-event
```

#### How It Works

- **For Hosts**: Connect Google Calendar in Dashboard → Calendar
- **Automatic Sync**: Meetings are automatically created/updated/deleted in Google Calendar
- **For Guests**: Can add meetings to their calendar via "Add to Calendar" button (Google Calendar link or .ics download)

### Supabase Auth Configuration

#### Configure Site URL and Redirect URLs

1. **Go to Supabase Dashboard**
   - Navigate to Authentication → URL Configuration

2. **Set Site URL**
   - Change from `http://localhost:3000` to your production URL:
     ```
     https://your-app.vercel.app
     ```
   - **Important**: This is what Supabase uses to construct email links

3. **Add Redirect URLs**
   - Add production callback URL:
     ```
     https://your-app.vercel.app/auth/callback
     https://your-app.vercel.app/api/calendar/google/callback
     ```
   - Keep localhost for development:
     ```
     http://localhost:3000/auth/callback
     http://localhost:3000/api/calendar/google/callback
     ```

4. **Save Changes**

## Deployment

### Deploy to Vercel

1. **Push your code to GitHub**

2. **Import project in Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository

3. **Add environment variables:**
   - In Vercel dashboard, go to Settings → Environment Variables
   - Add all required variables (see [Environment Variables](#environment-variables))
   - Update `NEXT_PUBLIC_SITE_URL` to your production domain

4. **Deploy:**
   - Click "Deploy"
   - Vercel will automatically build and deploy your app

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

- [ ] Environment variables set in Vercel
- [ ] Supabase Site URL set to production domain
- [ ] Redirect URLs configured in Supabase
- [ ] Edge Functions deployed
- [ ] Database webhooks configured
- [ ] HTTPS enabled
- [ ] Domain configured
- [ ] Database backups enabled

## How to Navigate the Application

### For End Users

#### Getting Started

1. **Sign Up**
   - Go to the landing page
   - Click "Sign Up"
   - Enter your email, password, first name, and last name
   - Check your email for confirmation link

2. **Profile Setup**
   - After confirming your email, you'll be redirected to profile setup
   - Choose a unique username (this becomes your public scheduling link)
   - Select your timezone
   - Complete setup

3. **Main Dashboard**
   - After setup, you'll see your main dashboard
   - **Navigation Links** (in header):
     - **Meetings**: View all your meetings
     - **Availability**: Set your weekly availability schedule
     - **Event Types**: Create meeting types (e.g., "30-minute consultation")
     - **Group Events**: Create events with multiple hosts
     - **Calendar**: Connect Google Calendar for automatic sync
     - **Sharing**: Share your dashboard with other users

#### Creating Event Types

1. Go to **Dashboard → Event Types**
2. Click "Create Event Type"
3. Fill in:
   - Name (e.g., "Coffee Chat")
   - Description
   - Duration (e.g., 30 minutes)
   - Location type (in-person, phone, video, custom)
   - Buffers (time before/after meeting)
   - Minimum notice (hours before booking)
   - Daily booking limit (optional)
4. Click "Create"
5. Your booking link will be generated automatically

#### Setting Availability

1. Go to **Dashboard → Availability**
2. For each day, click "Add time slot"
3. Set your available hours (e.g., 9:00 AM - 5:00 PM)
4. You can add multiple time slots per day
5. Click "Save Availability"

#### Booking a Meeting (as a Guest)

1. Visit the host's public scheduling page: `https://your-site.com/[username]`
2. Select an event type
3. Choose a date and time slot
4. Fill in your name and email
5. Add notes (optional)
6. Click "Book Meeting"
7. You'll see a confirmation page with calendar options

#### Managing Meetings

- **View Meetings**: Dashboard → Meetings
- **Reschedule**: Click "Reschedule" on a meeting, select new time
- **Cancel**: Click "Cancel" on a meeting
- **Add to Calendar**: Download .ics file or add to Google Calendar

#### Connecting Google Calendar

1. Go to **Dashboard → Calendar**
2. Click "Connect Google Calendar"
3. Authorize access in Google's OAuth flow
4. Your calendar is now connected
5. Future meetings will automatically sync

#### Sharing Your Dashboard

1. Go to **Dashboard → Sharing**
2. Enter the email of the user you want to share with
3. Choose permission level:
   - **View Only**: Can see your dashboard but can't make changes
   - **Edit**: Can view and modify your dashboard settings
4. Click "Grant Access"
5. The shared user will see your dashboard in "Dashboards Shared With Me"

#### Using Shared Dashboards

1. Go to **Dashboard → Sharing**
2. Under "Dashboards Shared With Me", click "View Dashboard" or "Edit Dashboard"
3. You'll see the owner's dashboard with their meetings, availability, and event types
4. Based on your permission level, you can view or edit

### For Developers

#### Key Routes

- `/` - Landing page
- `/auth/login` - Login page
- `/auth/signup` - Signup page
- `/dashboard` - Main dashboard (protected)
- `/dashboard/meetings` - Meetings list
- `/dashboard/availability` - Availability management
- `/dashboard/event-types` - Event types management
- `/dashboard/group-event-types` - Group event types
- `/dashboard/calendar` - Calendar integration
- `/dashboard/sharing` - Dashboard sharing management
- `/dashboard/shared/[ownerId]` - View shared dashboard
- `/[username]` - Public scheduling page
- `/book/[bookingLink]` - Public booking page
- `/book-group/[bookingLink]` - Group booking page
- `/booking/confirmed/[meetingId]` - Booking confirmation
- `/meeting/[meetingId]/reschedule` - Reschedule meeting
- `/meeting/[meetingId]/cancel` - Cancel meeting

#### Key Components

- `components/availability/availability-manager.tsx` - Availability CRUD
- `components/event-types/event-types-manager.tsx` - Event types CRUD
- `components/booking/booking-flow.tsx` - Single host booking flow
- `components/booking/group-booking-flow.tsx` - Group booking flow
- `components/meetings/meetings-list.tsx` - Meetings display
- `components/calendar/calendar-settings.tsx` - Calendar connection UI
- `components/dashboard-sharing/dashboard-sharing-manager.tsx` - Sharing management

#### Key Database Functions

- `calculate_availability()` - Calculates available time slots
- `book_meeting()` - Atomic meeting booking
- `book_group_meeting()` - Group meeting booking
- `reschedule_meeting()` - Reschedule with validation
- `cancel_meeting()` - Cancel meeting
- `get_user_display_name()` - Gets user display name from auth metadata
- `grant_dashboard_access()` - Grants dashboard sharing access
- `revoke_dashboard_access()` - Revokes dashboard sharing access
- `check_dashboard_access()` - Checks if user has access to dashboard

## Security

### ✅ Implemented Security Measures

#### Row Level Security (RLS)
- RLS enabled on all tables
- Users can only access their own data
- Dashboard sharing policies allow shared users to access owner's data based on permissions
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

## Troubleshooting

### Common Issues

#### Authentication Email Links Go to Localhost

**Problem**: Supabase confirmation emails have localhost links instead of production URL.

**Solution**:
1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Set **Site URL** to your production domain (e.g., `https://your-app.vercel.app`)
3. Add production redirect URLs
4. Set `NEXT_PUBLIC_SITE_URL` environment variable in Vercel
5. Redeploy application

#### RLS Permission Errors

**Problem**: Getting permission denied errors when accessing data.

**Solutions**:
- Verify all RLS policies are applied (check `DASHBOARD_SHARING_RLS_POLICIES.sql` if using sharing)
- Check user authentication status
- Verify user ID matches in queries
- Check that RPC functions are being used for inserts (not direct table inserts)

#### Booking Fails

**Problem**: Bookings are failing or showing conflicts.

**Solutions**:
- Check availability calculation function
- Verify event type is active
- Check for conflicts with existing meetings
- Verify timezone handling
- Check daily booking limits
- Ensure minimum notice requirements are met

#### Calendar Sync Not Working

**Problem**: Meetings not appearing in Google Calendar.

**Solutions**:
- Verify Google Calendar is connected in Dashboard → Calendar
- Check Edge Function logs in Supabase Dashboard
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
- Check that Edge Function `create-calendar-event` is deployed
- Verify OAuth scopes include calendar write access

#### Emails Not Sending

**Problem**: Confirmation or reminder emails not being sent.

**Solutions**:
- Check Mailgun Dashboard → Sending → Logs for errors
- Verify Edge Function environment variables are set
- Check Edge Function logs in Supabase Dashboard
- Verify webhook is configured correctly
- Ensure `MAILGUN_FROM_EMAIL` uses verified domain

#### Shared Dashboard Not Showing Data

**Problem**: Shared dashboard shows no meetings, availability, or event types.

**Solutions**:
- Verify RLS policies are updated (run `DASHBOARD_SHARING_RLS_POLICIES.sql`)
- Check that sharing access was granted correctly
- Verify permission level is 'view' or 'edit'
- Check that user has access via `dashboard_shares` table

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Supabase documentation: https://supabase.com/docs
3. Check Next.js documentation: https://nextjs.org/docs
4. Review the code comments in the codebase

---

**Status**: ✅ Production-ready with all core features implemented

Planno is a fully functional scheduling application with calendar integration, email notifications, and dashboard sharing capabilities.

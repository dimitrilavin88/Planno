# Dashboard Sharing Implementation Guide

## Overview
This document describes the dashboard sharing functionality that allows users to grant other users access to view or edit their dashboard.

## Implementation Phases

### Phase 1: Database Foundation ✅
**File:** `DASHBOARD_SHARING_SETUP.sql`

**What it includes:**
- `dashboard_shares` table to store sharing relationships
- RLS policies for the shares table
- Helper functions:
  - `check_dashboard_access()` - Check if user has access
  - `grant_dashboard_access()` - Grant access by email
  - `revoke_dashboard_access()` - Revoke access

**To run:**
1. Go to Supabase SQL Editor
2. Copy and paste the contents of `DASHBOARD_SHARING_SETUP.sql`
3. Execute it

### Phase 2: UI for Sharing ✅
**Files:**
- `app/dashboard/sharing/page.tsx` - Sharing management page
- `components/dashboard-sharing/dashboard-sharing-manager.tsx` - Main sharing component

**Features:**
- Form to grant access (email + permission level)
- List of current shares with revoke functionality
- "Dashboards Shared With Me" section
- Navigation link added to header

**Access:**
Navigate to `/dashboard/sharing` to manage dashboard shares

### Phase 3: Access Control ✅
**Files:**
- `lib/dashboard-access/utils.ts` - Access checking utilities
- `app/dashboard/shared/[ownerId]/page.tsx` - Shared dashboard view
- `components/dashboard-sharing/permission-gate.tsx` - Permission-based rendering
- `DASHBOARD_SHARING_RLS_POLICIES.sql` - RLS policy updates

**What it does:**
- Allows shared users to view owner's dashboard at `/dashboard/shared/[ownerId]`
- Enforces view/edit permissions
- Updates RLS policies to allow shared users to read owner's data
- Provides permission checking utilities

**To run:**
1. Run `DASHBOARD_SHARING_RLS_POLICIES.sql` in Supabase SQL Editor
2. This updates existing RLS policies to support sharing

## How It Works

### Granting Access
1. Owner goes to `/dashboard/sharing`
2. Enters user's email address
3. Selects permission level (View or Edit)
4. Clicks "Grant Access"
5. System looks up user by email and creates share record

### Accessing Shared Dashboard
1. Shared user goes to `/dashboard/sharing`
2. Sees "Dashboards Shared With Me" section
3. Clicks "View Dashboard" or "Edit Dashboard"
4. Redirected to `/dashboard/shared/[ownerId]`
5. System checks permissions and displays appropriate view

### Permission Levels

**View:**
- Can see dashboard data
- Can view meetings, availability, event types
- Cannot make changes
- Read-only access

**Edit:**
- All view permissions
- Can modify event types
- Can modify availability
- Can manage meetings
- Full edit access (except calendar connections for security)

## Database Schema

### dashboard_shares Table
```sql
- id (UUID, primary key)
- owner_user_id (UUID, references users)
- shared_with_user_id (UUID, references users)
- permission_level (TEXT: 'view' or 'edit')
- created_at, updated_at
- UNIQUE(owner_user_id, shared_with_user_id)
```

## RLS Policies Updated

The following tables now support shared access:
- `event_types` - Shared users can read/edit based on permission
- `availability_rules` - Shared users can read/edit based on permission
- `meetings` - Shared users can read/edit based on permission
- `calendars` - Shared users can view (read-only for security)

## Usage Examples

### Check Access in Code
```typescript
import { checkDashboardAccess } from '@/lib/dashboard-access/utils'

const access = await checkDashboardAccess(
  currentUserId,
  ownerUserId,
  'edit' // or 'view'
)

if (access.hasAccess) {
  // User has access
  if (access.permissionLevel === 'edit') {
    // Show edit buttons
  }
}
```

### Permission-Based Rendering
```tsx
import PermissionGate from '@/components/dashboard-sharing/permission-gate'

<PermissionGate hasPermission={access.permissionLevel === 'edit'}>
  <button>Edit</button>
</PermissionGate>
```

## Security Notes

1. **Calendar Connections**: Shared users can view calendar status but cannot modify connections (security measure)
2. **Self-Sharing**: Prevented by database constraint
3. **RLS Policies**: All data access is protected by Row Level Security
4. **Permission Checks**: Always verify permissions server-side

## Next Steps (Optional Enhancements)

1. **Notifications**: Email users when access is granted/revoked
2. **Activity Log**: Track who made changes to shared dashboards
3. **Expiration Dates**: Add time-limited access
4. **Bulk Sharing**: Share with multiple users at once
5. **Permission Requests**: Allow users to request access

## Troubleshooting

**Issue:** "User not found" when granting access
- **Solution:** User must have an account with that email address

**Issue:** Shared user can't see data
- **Solution:** Ensure `DASHBOARD_SHARING_RLS_POLICIES.sql` has been run

**Issue:** Permission checks not working
- **Solution:** Verify `check_dashboard_access` function exists and has correct permissions


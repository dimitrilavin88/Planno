import { createClient } from '@/lib/supabase/server'

export interface DashboardAccess {
  hasAccess: boolean
  permissionLevel: 'view' | 'edit' | null
  isOwner: boolean
  ownerUserId: string
}

/**
 * Check if a user has access to a dashboard
 * @param currentUserId - The ID of the user trying to access
 * @param ownerUserId - The ID of the dashboard owner
 * @param requiredPermission - The minimum permission level needed ('view' or 'edit')
 * @returns DashboardAccess object with access information
 */
export async function checkDashboardAccess(
  currentUserId: string,
  ownerUserId: string,
  requiredPermission: 'view' | 'edit' = 'view'
): Promise<DashboardAccess> {
  const supabase = await createClient()

  // If user is the owner, they have full access
  if (currentUserId === ownerUserId) {
    return {
      hasAccess: true,
      permissionLevel: 'edit',
      isOwner: true,
      ownerUserId
    }
  }

  // Check for shared access
  const { data, error } = await supabase.rpc('check_dashboard_access', {
    p_user_id: currentUserId,
    p_owner_user_id: ownerUserId,
    p_required_permission: requiredPermission
  })

  if (error || !data) {
    return {
      hasAccess: false,
      permissionLevel: null,
      isOwner: false,
      ownerUserId
    }
  }

  return {
    hasAccess: data !== null,
    permissionLevel: data as 'view' | 'edit' | null,
    isOwner: false,
    ownerUserId
  }
}

/**
 * Get the effective user ID for dashboard operations
 * If viewing a shared dashboard, use the owner's ID
 * Otherwise, use the current user's ID
 */
export async function getEffectiveUserId(
  currentUserId: string,
  ownerUserId?: string
): Promise<string> {
  if (ownerUserId && ownerUserId !== currentUserId) {
    // Check if user has access to this shared dashboard
    const access = await checkDashboardAccess(currentUserId, ownerUserId, 'view')
    if (access.hasAccess) {
      return ownerUserId
    }
  }
  return currentUserId
}


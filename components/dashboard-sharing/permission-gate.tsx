'use client'

interface PermissionGateProps {
  hasPermission: boolean
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * Component to conditionally render content based on permissions
 * Use this to hide/show edit buttons, forms, etc. based on access level
 */
export default function PermissionGate({ 
  hasPermission, 
  children, 
  fallback = null 
}: PermissionGateProps) {
  if (!hasPermission) {
    return <>{fallback}</>
  }

  return <>{children}</>
}


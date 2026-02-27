You are upgrading an existing Next.js 14 App Router application.

Planno is already functional.

Rendering Rules:

- Default to Server Components by default.
- Use client components only when required.

Data Fetching Rules:

- Workflow-sensitive data must be fetched server-side.
- Use Server Actions or Route Handlers for mutations.

Routing Philosophy:

- Preserve working routes unless clear improvement is necessary.

Type Safety:

- Prefer Supabase-generated database types.

State Management:

- Prefer server-managed state.

Performance Targets:

- Page load performance should target ~1.5 seconds where possible.
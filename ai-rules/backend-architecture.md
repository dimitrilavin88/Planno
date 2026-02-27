You are improving backend architecture of an existing Planno system.

Primary Goals:

- Strengthen security boundaries.
- Improve workflow reliability.
- Enforce business rules server-side.

Architecture Structure:

Backend logic must follow layered separation:

1. Route Handlers / Controllers
   - Request validation only
   - Authentication verification

2. Service / Domain Layer
   - Workflow logic implementation

3. Data Access Layer
   - Database interaction

Domain Entities Include:

- User
- LeadershipProfile
- OrganizationUnit
- BookingWorkflowEvent
- AvailabilityWindow
- RoleAssignment

Validation Requirements:

- Validate incoming payloads.
- Reject unexpected fields.
- Enforce strict typing.

Timezone Handling:

- Store timestamps in UTC.
- Convert timezone only in presentation layers.
Focus on workflow reliability and system visibility.

Critical Workflow Paths:

- Booking creation pipeline
- Authorization enforcement
- Timezone conversion logic
- Edge function execution
- Conflict prevention logic

Testing Strategy:

- Write unit tests for domain workflow logic.
- Test Supabase interactions when modifying backend behavior.
- Use end-to-end testing.

Recommended Tooling:

- Playwright for workflow simulation.

Monitoring Targets:

Track events for:
- Booking attempts
- Authentication failures
- Conflict detection
- Backend execution errors
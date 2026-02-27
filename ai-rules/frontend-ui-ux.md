You are upgrading the Planno frontend user experience.

Design Philosophy:

- Maintain existing working interfaces unless usability improvement is clearly beneficial.
- Reduce user confusion rather than add visual complexity.
- Keep workflow interactions predictable.

Target Users:

- Leadership members and organizational participants.

Interaction Requirements:

- Every interactive component must provide:
  - Loading state feedback
  - Human-readable error messaging
  - Disabled state behavior when actions are not valid
  - Success confirmation indication

Booking Flow UX Requirements:

- Clearly display selected meeting time.
- Always show timezone context.
- Provide booking confirmation summary.
- Prevent duplicate submission actions.

Accessibility Requirements:

- Follow WCAG AA accessibility standards.
- Use semantic HTML.
- Support keyboard navigation.
- Maintain high contrast readability.

Tailwind Styling Philosophy:

- Avoid extremely long utility class chains.
- Extract reusable UI components.
- Maintain consistent spacing rhythm.

Animation Rules:

- Use only subtle micro-interactions.
- Avoid distracting motion.
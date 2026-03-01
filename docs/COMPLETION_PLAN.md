# Planno – Completion Plan (Ordered Checklist)

This plan is ordered by **dependency and risk**: security and observability first, then structure, then migration, then polish. It follows the ai-rules (security hardening, observability, incremental improvement, no large-scale rewrites).

---

## Completed

| # | Task | Notes |
|---|------|--------|
| — | **RLS on `reminders`** | Done. Only backend can access reminder data; clients have no direct access. |
| — | **Audit logging** | Done. `workflow_audit_log` table; booking create/reschedule/cancel and series cancel write audit rows. Auth-failure logging can be added later. |
| — | **Rate limiting** | Done. DB: `rate_limit_attempts` + `check_rate_limit()`; booking RPCs (10/min); API routes confirm-sms and group-availability by IP. Auth: Supabase [auth.rate_limit]. |

---

## Phase 1 – Security & data integrity

Harden the system before scaling or migrating. Per ai-rules: security hardening and validation completeness come first.

| # | Task | Why this order |
|---|------|----------------|
| 1 | **Session/cookie hardening** | Security standards: HttpOnly, SameSite=strict, short-lived tokens; CSRF for mutations. Lock down auth before migration so we don’t move a weak session model. |

---

## Phase 2 – Observability & confidence

Per ai-rules: focus on observability and workflow reliability. Need visibility and tests before changing infrastructure.

| # | Task | Why this order |
|---|------|----------------|
| 3 | **Monitoring** | Track booking attempts, auth failures, conflict detection, backend errors. Required to verify behavior during and after migration and to operate safely on a larger cloud. |
| 4 | **Testing** | Unit tests for booking, auth, timezone, conflict logic (per general-engineering and observability-testing). Then Playwright E2E for critical workflows. Gives a safety net so migration and future refactors don’t break behavior; refactor-and-upgrade-mode says "analyze current implementation" and test critical paths. |

---

## Phase 3 – Structure (incremental)

Per ai-rules: improve structure incrementally; extract logic, don’t rewrite. Do enough before migration so the codebase is in good shape when moving.

| # | Task | Why this order |
|---|------|----------------|
| 5 | **Backend layering** | Backend-architecture: route → service → data; strict validation. Apply where missing, by extraction not rewrite. Complete before migration so the app is easier to reason about and deploy on the new platform. |

---

## Phase 4 – Cloud migration

Move to a larger cloud service only after security, observability, and tests are in place. Per ai-rules: preserve working behavior; avoid big rewrites; improve incrementally.

| # | Task | Why this order |
|---|------|----------------|
| 6 | **Cloud migration to larger cloud service** | Do after Phases 1–3 so that: (1) security and audit are in place, (2) monitoring and tests can validate the move and catch regressions, (3) backend structure is clearer. Plan migration as a focused infra change, not combined with large feature or UX rewrites. |

---

## Phase 5 – UX & accessibility polish

Per ai-rules: UX clarity and accessibility; reduce confusion; don’t change working behavior unnecessarily. Do after migration so infra and UX aren’t changing at once.

| # | Task | Why this order |
|---|------|----------------|
| 7 | **UX / accessibility** | Frontend-ui-ux: loading/error/disabled/success on interactive components; WCAG AA; semantic HTML; keyboard nav. Tackle after migration has stabilized so we’re not doing major UX and infra changes in parallel. |

---

## Summary order (1 → 6 remaining)

1. ~~Audit logging~~ ✅  
2. ~~Rate limiting~~ ✅  
3. Session/cookie hardening  
4. Monitoring  
5. Testing (unit, then E2E)  
6. Backend layering (incremental)  
7. Cloud migration to larger cloud service  
8. UX / accessibility polish  

---

*Ref: ai-rules (project.md, refactor-and-upgrade-mode.md, security-standards.md, observability-testing.md, backend-architecture.md, frontend-ui-ux.md, general-engineering.md).*

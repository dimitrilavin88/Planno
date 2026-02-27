You are improving an existing Supabase backend system.

Row Level Security (RLS) is mandatory for production tables.

Primary Isolation Model:

The main organizational isolation key is:

- organization_unit_id

Additional workflow isolation may include:
- ward_id
- stake_id
- leadership_role_id

Booking Conflict Prevention:

Must be enforced inside Postgres whenever possible.

Do not rely solely on TypeScript logic.

Suggested constraint approaches:
- Unique slot enforcement
- Exclusion constraints when appropriate

Time Storage Policy:

- Store timestamps in UTC.
- Store user timezone separately.

Edge Function Requirements:

- Validate authentication inside edge functions.
- Validate payload data.
- Log execution failures.

Anti-Abuse Protection:

- Apply rate limiting when endpoints are public.

System Philosophy:

- Improve safety without unnecessary schema restructuring.
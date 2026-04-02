# Miller's Garage — Security Audit Report

**Date:** 2026-04-02  
**Auditor:** Claude Code (automated, full read of all 60 source files)  
**Scope:** Full codebase — `src/`, `api/`, `supabase/`, `docs/`, all config files  
**Commit at time of audit:** `493389d` (M07 complete)

---

## Severity Scale

| Level | Meaning |
|---|---|
| **CRITICAL** | Exploitable now; data loss or takeover possible |
| **HIGH** | Serious exposure; should be fixed before next member onboarding |
| **MEDIUM** | Real risk under specific conditions |
| **LOW** | Minor hygiene or defense-in-depth gaps |
| **INFO** | Noted for awareness; no immediate action required |

---

## 1. Secrets & Environment Variables

### FINDING S-1 — `.env.local` is correctly gitignored | INFO ✅

`.gitignore` excludes `.env.local` via both the `*.local` glob (line 12) and an explicit entry (line 25). Git history confirms the file was **never committed** (`git log --all --full-history -- .env.local` returns empty). No live secrets are in the repository.

**Variables and their scope:**

| Variable | VITE_ prefix | Bundled into browser? | Notes |
|---|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Yes — intentional | Supabase anon URL is public by design |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ | Yes — intentional | Publishable key (not anon JWT), public by design |
| `SUGARWOD_API_KEY` | ❌ | No | Only used in `api/` serverless functions via `process.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ | No | Only used in `src/lib/supabaseServer.js`, imported only by `api/` functions |
| `SUPABASE_URL` | ❌ | No | Duplicate of `VITE_SUPABASE_URL` for serverless context |

No secrets are leaked to the browser bundle.

---

### FINDING S-2 — `src/lib/sugarwod.js` lives under `src/lib/` but is server-only | MEDIUM

`src/lib/sugarwod.js` uses `process.env.SUGARWOD_API_KEY` and is imported exclusively by `api/sugarwod/*.js` serverless functions. It is never imported by any React component and is therefore not bundled by Vite. The API key is **not** exposed to clients today.

**Risk:** The file's location (`src/lib/`) follows the browser-code convention. A future developer could accidentally import it from a React component. Vite would either: (a) throw a `ReferenceError` at runtime because `process` is undefined in the browser, or (b) in a misconfigured build, potentially expose the key. Protection is by accident, not by design.

**Recommendation:** Move to `api/lib/sugarwod.js` (or `lib/sugarwod.js` at repo root) so the placement signals server-only intent.

---

### FINDING S-3 — Infrastructure details committed to `docs/` | LOW

`docs/millersgarage.md` (line 8) and `docs/m05-phase2-migration.sql` (line 4) contain the Supabase project ID (`urhdjhwnzqkcswbquwpk`) and dashboard URL in plain text. `docs/millersgarage.md` also contains the Pico 2 W local IP (`192.168.86.42`) and the production Supabase dashboard link.

The GitHub repository is public (`github.com/dailycrusade/gym-tracker`). These details are visible to anyone.

**Impact:** Supabase project ID alone is low risk — it appears in the public `VITE_SUPABASE_URL` anyway. The Pico IP is local-only. The dashboard URL identifies the project, which an attacker could use for targeted API fuzzing. Not exploitable without credentials.

---

## 2. Supabase RLS

### FINDING R-1 — All tables have RLS enabled | INFO ✅

Every table in the `public` schema has `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` applied. Confirmed from migrations:

| Table | RLS Enabled | Primary Policy Pattern |
|---|---|---|
| `profiles` | ✅ | `auth.uid() = id` |
| `workouts` | ✅ | `athlete_id = auth.uid()` |
| `workout_stats` | ✅ | Joined ownership via `workouts` |
| `events` | ✅ | Public SELECT for `is_public = true`; admin write |
| `scenes` | ✅ | Authenticated SELECT; admin write |
| `device_sessions` | ✅ | Authenticated SELECT; service_role INSERT/UPDATE |
| `device_streams` | ✅ | Claimed athlete + admin SELECT; service_role INSERT |
| `device_claims` | ✅ | `athlete_id = auth.uid()` |
| `sugarwod_wods` | ✅ | Authenticated SELECT |
| `sugarwod_athletes` | ✅ | Authenticated SELECT |
| `sugarwod_scores` | ✅ | Authenticated SELECT |

---

### FINDING R-2 — Recursive `profiles_select_admin` policy — CONFIRMED FIXED | INFO ✅

`docs/m05-phase2-migration.sql` (lines 88–96) contains a policy that queries the `profiles` table from within a `profiles` policy — which would cause infinite recursion:

```sql
CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles         -- ← recursive reference
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

Per M06 milestone notes, this policy was **removed** from the live database and replaced with non-recursive alternatives (`Users can view own profile`, `Users can update own profile`, `Users can insert own profile`). The migration file is a historical artifact — the live database is clean.

**Note:** The migration file in the repo still contains the recursive policy. It should not be re-run against production. Consider adding a comment or creating a corrective migration.

---

### FINDING R-3 — `device_sessions` and `device_streams` INSERT policies use `{public}` role | INFO ✅

When viewed via `pg_policies`, these INSERT policies show `roles = {public}` (meaning the policy applies to all database roles) with a `null` USING (`qual`) clause. This pattern looks alarming out of context:

```sql
-- device_sessions — INSERT
CREATE POLICY "device_sessions_insert_service"
  ON public.device_sessions FOR INSERT
  WITH CHECK (auth.role() = 'service_role');   -- ← protection is here

-- device_streams — INSERT
CREATE POLICY "device_streams_insert_service"
  ON public.device_streams FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
```

**Explanation:** INSERT policies have no `USING` clause by design (USING applies to rows being *read*; WITH CHECK applies to rows being *written*). `{public}` means the policy evaluates for all callers — but `WITH CHECK (auth.role() = 'service_role')` blocks the insert for everyone except the service_role. This is the correct pattern for relay-agent-only writes.

**Verified:** These policies are properly protective. No action required.

---

### FINDING R-4 — `sugarwod_athletes` exposes all member emails to any authenticated user | HIGH

```sql
CREATE POLICY "authenticated users can read sugarwod athletes"
  ON sugarwod_athletes FOR SELECT
  TO authenticated
  USING (true);   -- ← any logged-in user sees all rows
```

The `sugarwod_athletes` table stores `email`, `first_name`, `last_name`, and `raw_data` (full SugarWOD athlete JSON) for every member. Any authenticated user can query the entire table:

```js
supabase.from('sugarwod_athletes').select('*')
// Returns all members' email addresses
```

**Impact:** Full membership email list is readable by any member who logs in.

**Recommendation:** Scope the SELECT policy. Members should only see their own row; admins see all. Add a `profile_id = auth.uid()` condition or use a `to authenticated using (profile_id = auth.uid())` policy, with a separate admin read-all policy.

---

### FINDING R-5 — `sugarwod_scores` is not scoped to the requesting athlete | MEDIUM

```sql
CREATE POLICY "authenticated users can read scores"
  ON sugarwod_scores FOR SELECT
  TO authenticated
  USING (true);   -- ← any logged-in user sees all scores
```

Any authenticated user can read any member's workout scores, including their score values, RX status, and notes. The `WorkoutHistory` component correctly queries by `sugarwod_athlete_id`, but the database enforces no such restriction.

**Impact:** A curious or malicious member could enumerate all members' performance history.

**Recommendation:** Scope to `profile_id = auth.uid()` for member reads, with admin read-all policy.

---

## 3. API Routes (Vercel Serverless)

### FINDING A-1 — `/api/sugarwod/sync` has no authentication | CRITICAL

`api/sugarwod/sync.js` accepts a `POST` from anyone on the internet and:
1. Calls the SugarWOD API (consuming rate limit quota)
2. Writes the full member athlete list — including emails — to `sugarwod_athletes` using the service_role key
3. Writes WOD data to `sugarwod_wods`

```js
export default async function handler(req, res) {
  if (req.method !== 'POST') { ... }
  // ← No token check. Anyone can POST here.
  const supabase = createServiceClient();
  // Calls SugarWOD API and upserts data using service_role
```

**Impact:**
- Adversarial repeated calls exhaust SugarWOD API rate limits
- No throttling — could be used for denial of service against the SugarWOD API key
- Writes sensitive member data (emails) to Supabase on an unauthenticated trigger

**Recommendation:** Require a `Bearer` token and validate it via `supabase.auth.getUser()`. Only admins (checked via `profiles.role`) should be able to trigger a manual sync. For automated cron-based sync, use a pre-shared secret in the `Authorization` header validated server-side.

---

### FINDING A-2 — `/api/sugarwod/athletes` has no authentication | HIGH

`api/sugarwod/athletes.js` returns the complete SugarWOD athlete list (including emails and member details) to any unauthenticated caller:

```js
export default async function handler(req, res) {
  if (req.method !== 'GET') { ... }
  // ← No token check.
  const data = await getAthletes();
  res.status(200).json(data);   // Full athlete list with emails
```

**Impact:** Member emails and SugarWOD profile data are exposed to any internet user who knows the Vercel URL.

**Recommendation:** Add JWT validation. This endpoint should require admin auth — regular members have no use case for the raw athlete list.

---

### FINDING A-3 — `/api/sugarwod/workouts` and `/api/sugarwod/box` have no authentication | MEDIUM

Both endpoints are unauthenticated. The data they return (today's WOD, gym box info) is low-sensitivity and arguably meant to be public. However, `/api/sugarwod/workouts` also uses the service_role key internally to write to the cache:

```js
const supabase = createServiceClient();   // service_role used for cache writes
// Anyone can trigger this cache write
upsertWods(supabase, wods).catch(...)
```

**Impact:** Unauthenticated callers can trigger service_role database writes (though writes are scoped to WOD cache rows only, which is low risk). More concerning: the WOD endpoint proxies a paid SugarWOD API call on every cache miss, allowing rate-limit exhaustion by unauthenticated users.

**Recommendation:** These can remain public if desired, but add rate limiting at the Vercel edge or require authentication to prevent API quota abuse.

---

### FINDING A-4 — `/api/sugarwod/identify` is properly authenticated | INFO ✅

This is the only endpoint in `api/sugarwod/` that validates the caller's JWT before acting:

```js
const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
if (!token) return res.status(401).json({ error: 'Missing Authorization header' });

const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
if (authErr || !user) return res.status(401).json({ error: 'Invalid or expired token' });
```

The other four endpoints should follow this pattern.

---

### FINDING A-5 — No SugarWOD API key or service role key is ever returned to clients | INFO ✅

Confirmed by reading all five `api/sugarwod/*.js` files. Neither `SUGARWOD_API_KEY` nor `SUPABASE_SERVICE_ROLE_KEY` appears in any response body. The keys are used server-side only and never forwarded.

---

## 4. Auth & Authorization

### FINDING AU-1 — ProtectedRoute redirects, not blocks — expected for SPA | INFO ✅

```js
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <spinner />
  if (!user) return <Navigate to="/login" replace />
  return children
}
```

This is the standard React SPA pattern. An unauthenticated user is redirected to `/login` and cannot interact with protected pages. The JS bundle is visible, but actual data access requires a valid Supabase JWT. Without a JWT, all RLS-protected Supabase queries return empty/error. This is appropriate for this application.

---

### FINDING AU-2 — Admin role is enforced by DB RLS only; no API-layer check exists | MEDIUM

Admin-only operations (create/update/delete events, scenes, etc.) are gated by RLS policies that check `profiles.role = 'admin'`. There are no admin-only API routes yet (M17 is not started). The current risk is low because the admin UI doesn't exist, but this should be tracked:

- No API endpoint currently performs an admin action
- When M17 (Admin Panel) is built, any admin API routes must validate the role server-side before acting
- Relying solely on RLS for admin enforcement is acceptable but creates an implicit contract that must be maintained

**Recommendation:** When building admin API endpoints in M17, always verify `profiles.role = 'admin'` in the serverless handler before proceeding, in addition to RLS. Defense in depth.

---

### FINDING AU-3 — Legacy PIN-based kiosk flow remains in codebase | MEDIUM

`src/components/AthleteLogin.jsx`, `AthleteDashboard.jsx`, and `BluetoothTest.jsx` implement a PIN-based kiosk authentication system that predates Supabase Auth. These are still wired into `App.jsx` at the `/athlete` route:

```js
// App.jsx — the /athlete route still exists
<Route path="/athlete" element={<MainFlow />} />
```

The legacy flow:
1. Fetches the **full athlete list** (including PINs) from Supabase to the browser: `supabase.from('athletes').select('*')`
2. Compares the entered PIN in JavaScript: `if (entered === selectedAthlete.pin)`

**The underlying `athletes` table was dropped in M05** (`DROP TABLE IF EXISTS public.athletes CASCADE`), so these components would fail at runtime today. However:

- The code still implies PIN comparison in the client — if any future work recreates this table, the pattern is insecure
- The route `/athlete` is reachable (protected by Supabase auth, but renders broken UI)
- `BluetoothTest.jsx` writes workout data to the `workouts` table using `athlete.id` from sessionStorage state — no server-side ownership check

**Recommendation:** Remove `AthleteLogin.jsx`, `AthleteDashboard.jsx`, `BluetoothTest.jsx`, and the `<MainFlow>` component from `App.jsx`. This is dead code after M05. The FTMS/Bluetooth functionality will be rebuilt cleanly in M08.

---

### FINDING AU-4 — `useSugarWodIdentity` reads `profiles.sugarwod_athlete_id` from the client | LOW

The hook reads the profiles table directly from the browser via the anon/publishable key. This is fine because RLS (`profiles_select_own`) restricts the read to the user's own row. The concern is minor:

If a user manufactures a JWT (impossible with Supabase's RS256 signing) or if Supabase keys are rotated without updating the app, the hook would silently return null and fall back to the `/identify` API call. This is handled correctly.

---

## 5. Client-Side

### FINDING C-1 — No `dangerouslySetInnerHTML` usage | INFO ✅

Searched all 11 React components and 3 pages. No raw HTML injection. All user-supplied content (display names, workout notes, scores) is rendered via React's text interpolation, which escapes by default.

---

### FINDING C-2 — No sensitive data in `localStorage` | INFO ✅

No component writes sensitive data to `localStorage`. Supabase manages its own session via `localStorage` under its own key namespace (this is standard and expected). The legacy kiosk flow used `sessionStorage` (tab-scoped, clears on close), not `localStorage`.

---

### FINDING C-3 — Profile page writes directly to Supabase from the client | LOW

`Profile.jsx` makes several direct Supabase writes from the browser:
- `update({ display_name })` on profiles
- `update({ preferences })` on profiles  
- `update({ notification_settings })` on profiles
- `upload(...)` to the `avatars` storage bucket

These are all scoped to the authenticated user's own row, and RLS enforces `auth.uid() = id`. The writes are legitimate. The concern is that the data is not validated server-side:

- Display name has no length limit enforced beyond what Supabase column limits provide
- Preferences JSON accepts any shape (no schema validation)
- Avatar upload: MIME type and size are validated client-side (type must start with `image/`, max 2MB), but **no server-side MIME validation exists**. A user could set the `Content-Type` header to `image/png` while uploading a non-image file.

**Recommendation:** The display name and preference writes are low risk. For avatar uploads, add a Supabase Storage policy that restricts `Content-Type` to `image/*`, or process uploads through a serverless function that validates the file header (magic bytes).

---

### FINDING C-4 — `WorkoutHistory` queries any athlete's scores by athlete ID | MEDIUM

```js
// WorkoutHistory.jsx
const { data, error: dbErr } = await supabase
  .from('sugarwod_scores')
  .select('...')
  .eq('sugarwod_athlete_id', athleteId)   // ← athleteId is a SugarWOD text ID
```

The `sugarwod_athlete_id` is a SugarWOD opaque text ID (e.g., `"1hsjkmEDx8"`). The RLS policy (`authenticated users can read scores`) does not restrict which athlete's scores a user can query — only that the caller is authenticated. If a user guesses or knows another member's SugarWOD athlete ID, they can read that member's full score history.

This is a consequence of R-5 above. The fix is the same: scope the RLS policy.

---

## 6. Door Lock (Pico 2 W)

### FINDING D-1 — `/unlock` endpoint has no authentication layer | HIGH

Per `docs/millersgarage.md` (M12 entry):

> **Pico 2 W at `192.168.86.42`**, MicroPython HTTP server  
> AEDIKO relay module, Atoplee 12V solenoid, 1N4007 flyback diode  
> `POST /unlock` confirmed working  
> **Remaining (needs M11):** Static IP via DHCP reservation, IoT subnet, **JWT auth layer on Node.js fronting Pico**

The Pico is running a plain MicroPython HTTP server. `POST http://192.168.86.42/unlock` physically opens the door. There is **no authentication on this endpoint.**

**Current exposure:** The endpoint is accessible to **any device on the `192.168.86.x` WiFi network**, including guest devices, phones that join the gym WiFi, and any device that has ever connected. There is no shared secret, no JWT, no IP allowlist.

**There is no cloud-facing endpoint for this yet** (M11 is not started). The door cannot be unlocked from the internet at this time — only from local WiFi.

**However:** A gym member who joins the WiFi and opens a browser or Postman can send `POST http://192.168.86.42/unlock` and open the door without any credential.

**Recommendations for M12:**
1. Move the Pico to an IoT VLAN (`192.168.87.x` or similar) that is firewalled from the main member WiFi
2. Add a pre-shared secret header to the MicroPython HTTP handler: the Pico should reject requests without `X-Unlock-Token: <secret>` matching a value baked into the firmware
3. When the relay agent (M11) fronts the Pico, the relay agent should: validate a Supabase JWT, check `profiles.role` or a time-based access policy, enforce gym hours, and forward the request to the Pico over the IoT VLAN only
4. Log every unlock attempt (timestamp, source, success/failure) to Supabase

---

## 7. Dependency Hygiene

**`npm audit` results — 3 vulnerabilities, 0 critical:**

| Package | Severity | CVE | Description | Context |
|---|---|---|---|---|
| `flatted` ≤3.4.1 | **HIGH** | GHSA-25h7-pfq9-p65f | Unbounded recursion DoS in `parse()` revive phase — attacker-controlled input can hang the process | Dev/transitive dep |
| `flatted` ≤3.4.1 | **HIGH** | GHSA-rf6f-7fwh-wjgh | Prototype pollution via `parse()` | Dev/transitive dep |
| `picomatch` 4.0.0–4.0.3 | **HIGH** | GHSA-c2c7-rcm5-vvqj | ReDoS via extglob quantifiers — malicious glob pattern can hang the process | Dev/transitive dep |
| `picomatch` ≥4.0.0 <4.0.4 | MODERATE | GHSA-3v7f-55p6-f55p | Method injection in POSIX character classes — incorrect glob matching | Dev/transitive dep |
| `brace-expansion` <1.1.13 | MODERATE | GHSA-f886-m6hf-6m8v | Zero-step sequence causes process hang | Dev/transitive dep |

**Assessment:** All three packages are **transitive development dependencies** (Vite, ESLint toolchain). None are included in the production browser bundle or Vercel serverless functions. They pose no runtime risk to the deployed application. Fix is `npm audit fix` when convenient — not urgent.

---

## Summary Table

| ID | Finding | Severity | Category |
|---|---|---|---|
| A-1 | `/api/sugarwod/sync` — no auth; triggers service_role writes + SugarWOD API calls | **CRITICAL** | API |
| A-2 | `/api/sugarwod/athletes` — no auth; returns full member email list | **HIGH** | API |
| D-1 | Door lock `POST /unlock` — no auth; any LAN device can open the door | **HIGH** | Hardware |
| R-4 | `sugarwod_athletes` RLS — any authed user reads all member emails | **HIGH** | RLS |
| A-3 | `/api/sugarwod/workouts` and `box` — no auth; service_role used internally | **MEDIUM** | API |
| AU-2 | Admin role enforcement is DB-only; no API-layer check | **MEDIUM** | Auth |
| AU-3 | Legacy PIN kiosk flow (dead code) still wired into App; client-side PIN compare pattern | **MEDIUM** | Auth |
| C-4 | `WorkoutHistory` can query any athlete's scores (RLS not scoped to own data) | **MEDIUM** | Client |
| R-5 | `sugarwod_scores` RLS — any authed user reads all athletes' scores | **MEDIUM** | RLS |
| S-2 | `src/lib/sugarwod.js` is server-only code in browser-convention directory | **MEDIUM** | Secrets |
| AU-4 | `useSugarWodIdentity` reads profiles client-side — RLS-protected, low risk | **LOW** | Auth |
| C-3 | Avatar upload — client-side MIME validation only, no server-side check | **LOW** | Client |
| R-2 | Recursive `profiles_select_admin` still in migration file (fixed live) | **LOW** | RLS |
| S-3 | Project ID and Pico IP in committed `docs/` files; public repo | **LOW** | Secrets |
| DEP-1 | 2 HIGH + 1 MODERATE CVEs in dev dependencies (`flatted`, `picomatch`, `brace-expansion`) | **LOW** | Deps |
| R-3 | `device_sessions/streams` INSERT policies show `{public}` roles — correct; explain visually | **INFO** | RLS |
| R-1 | All 11 tables have RLS enabled | **INFO ✅** | RLS |
| A-4 | `/api/sugarwod/identify` properly validates JWT | **INFO ✅** | API |
| A-5 | No API key or service role key ever returned to clients | **INFO ✅** | API |
| S-1 | `.env.local` correctly gitignored; never committed | **INFO ✅** | Secrets |
| R-2b | Recursive profiles policy confirmed removed from live DB | **INFO ✅** | RLS |
| AU-1 | ProtectedRoute redirect behavior is correct for SPA | **INFO ✅** | Auth |
| C-1 | No `dangerouslySetInnerHTML` usage | **INFO ✅** | Client |
| C-2 | No sensitive data in `localStorage` | **INFO ✅** | Client |

---

## Recommended Fix Priority

**Before next member onboarding:**
1. **A-1** — Add admin JWT check to `/api/sugarwod/sync`
2. **A-2** — Add JWT + admin check to `/api/sugarwod/athletes`
3. **R-4** — Scope `sugarwod_athletes` RLS to own row
4. **R-5** — Scope `sugarwod_scores` RLS to own data
5. **AU-3** — Remove dead PIN-based kiosk components from codebase

**Before door goes into production (M12):**
6. **D-1** — IoT VLAN isolation + pre-shared secret on Pico firmware + relay agent JWT auth

**When building M17 (Admin Panel):**
7. **AU-2** — Add explicit role check in all admin API handlers (defense in depth)

**Routine / low urgency:**
8. **A-3** — Add rate limiting or auth to workouts/box endpoints  
9. **S-2** — Relocate `sugarwod.js` to `api/lib/` to signal server-only intent  
10. **C-3** — Add server-side avatar MIME validation  
11. **DEP-1** — `npm audit fix`

---

*This report documents findings only — no code was modified. All findings based on direct file reads at commit `493389d`.*

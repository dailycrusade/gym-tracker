# Miller's Garage — Project Context & Milestone Tracker

> **Last updated:** March 31, 2026  
> **Entity:** Certago LLC (Nebraska) — DBA Miller's Garage  
> **Repo:** https://github.com/dailycrusade/gym-tracker  
> **Production URL:** https://millersgarage.com  
> **Vercel fallback:** https://gym-tracker-sandy-eight.vercel.app  
> **Supabase project:** RogueStats (project ID: urhdjhwnzqkcswbquwpk)

---

## 🧬 Origin & Identity

**Miller's Garage** is a faith-integrated community wellness space built by Steve and Andrea Miller in their converted two-car garage (~20×22ft) in Papillion, Nebraska. Named after Steve's grandfather Frank "Pop Pop" Miller, who ran a garage in the 1940s that functioned as a relational community hub. Steve worked there before joining the military. The space is being reimagined as a modern third space — rooted in presence, community, and Kingdom investment.

**Certago LLC** is the parent company. The name comes from Latin: *certus* (fixed, resolved, certain) + *agere* (to set in motion, drive forward) = "to move forward with resolve" / "movement from a decision already made."

**Two-layer model:**
- **Mission layer (Miller's Garage):** Free, open, relational. Never charges for community gathering.
- **Business layer (Certago):** Coaching, training, programming, merchandise. Generates revenue to sustain the mission.

**Core themes:** Presence over productivity · Contribution over consumption · Community over transaction · Purpose over profit

---

## 🏗️ Physical Space

- **Space:** ~20×22ft two-car garage, rubber flooring, plywood walls, 10ft ceilings
- **Cabinet:** Custom floor-to-ceiling (36"W × 18"D × 10ft, pentagon footprint, 45° angled face SE)
  - 0–16": closed base (subwoofer + vacuum)
  - 16–44": closed rack (JBL MA310, Mac Mini M4, fiber modem, Apple TV, Pi 5, patch panel)
  - 44–60": angled face panel (VESA display / iPad mount, keystone ports)
  - 60–72": charging shelf
  - 72–84": temp shelf
  - 84–120": cable/vent zone
- **Displays:** 100" projector (west wall via JBL MA310), portrait monitor (west wall USB-C), mirror display (south wall, HDMI over CAT6 ~40ft), cabinet face (iPad now)
- **LED Zones:**
  - Zone 1: Hexagon cluster — Lutron Caseta smart dimmer
  - Zone 2: WS2812B RGBW ceiling perimeter — ESP32 + WLED, music reactive (INMP441)
  - Zone 3: RGB behind east wall curtain — second ESP32 channel
- **Control:** Home Assistant on Mac Mini · WLED REST API · macOS BT agent (FTMS)

---

## 💻 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 7 + Tailwind CSS v4 |
| Language | Plain JSX (no TypeScript) |
| Database | Supabase (Postgres) — project: RogueStats |
| Auth | Not yet implemented (Supabase Auth planned) |
| Hosting | Vercel (auto-deploy from main branch) |
| Domain | millersgarage.com (NameBright → Cloudflare DNS → Vercel) |
| Local agent | Pi 5 (planned: Python/Node, systemd service) |
| BT devices | Rogue Echo Bike + Rogue Ski Erg (FTMS protocol) |
| Door lock | Raspberry Pi Pico 2 W + AEDIKO relay + Atoplee 12V solenoid |
| Lights | WLED (ESP32) + Home Assistant + Lutron Caseta |
| Mini apps | Darts, Poker, Cornhole (planned React apps) |

---

## 🔑 Environment Variables

| Variable | Location | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Vercel + .env.local | Stable |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Vercel + .env.local | New format (sb_publishable_...) |

`.env.local` is gitignored via `*.local` pattern + explicit entry on line 25.

---

## 🏋️ Milestone Plan

Use milestone IDs when starting new threads. Format: **"Milestone [ID]: [Title]"**

---

### SPRINT 0 — Housekeeping
**M00 — Repo & Secrets Hygiene** ✅ COMPLETE
- Rotated to new Supabase publishable key format
- `.env.local` confirmed gitignored
- `VITE_SUPABASE_PUBLISHABLE_KEY` added to Vercel, old `VITE_SUPABASE_ANON_KEY` removed

---

### FOUNDATION

**M01 — Domain & Hosting** ✅ COMPLETE
- `millersgarage.com` purchased (NameBright via HugeDomains)
- `millersgarage.net` + `millersgarage.org` purchased (Squarespace) — redirect to .com
- Cloudflare DNS: nameservers `aria.ns.cloudflare.com` + `gerardo.ns.cloudflare.com`
- Vercel connected: A record `76.76.21.21` + CNAME `cname.vercel-dns.com` (DNS only)
- SSL certificates generated and valid

**M02 — Supabase Auth + User Model** ✅ COMPLETE
- Supabase Auth implemented: email/password + Google SSO
- AuthContext and AuthProvider in `src/context/AuthContext.jsx`
- ProtectedRoute component in `src/components/ProtectedRoute.jsx`
- Supabase client initialized in `src/lib/supabase.js`
- Login page at `src/pages/Login.jsx`
- `profiles` table with auto-trigger + RLS policies
- Site URL + redirect URLs configured in Supabase
- Protected routes wired in `App.jsx`
- Deployed and live at millersgarage.com

**M03 — Routing & App Shell** ✅ COMPLETE
- Tailwind v4 design tokens added to `src/index.css` via `@theme`:
  - `--color-mg-purple: #7B68EE`
  - `--color-mg-teal: #6DD5D5`
  - `--color-mg-cream: #F5F0E8`
  - `--color-mg-black: #0D0D0D`
  - `--color-mg-surface: #1A1A2E`
  - `--color-mg-border: #2A2A4A`
  - `--font-display: Georgia, serif` (placeholder until Erin font export)
  - `--font-body: Inter, system-ui, sans-serif` (placeholder)
- `AppShell` at `src/components/AppShell.jsx`: fixed top header (wordmark, user avatar initials), fixed bottom nav (Home, Workout, Leaderboard, Profile), active tab indicator
- `App.jsx` restructured with layout route pattern: `ShellLayout` wraps protected routes via `Outlet`; `/login` and `/display/:machine` remain shell-free; `/profile` added as placeholder (M06)
- Hub internal header removed (eliminated double-header)
- Verified live at millersgarage.com
- ⚠️ Typography tokens are system fallbacks — swap to Span + Proxima Nova in M04 once Erin Pille delivers SVG + font license

**M04 — Public Landing Page** ✅ COMPLETE
- `src/pages/Landing.jsx` built and live at millersgarage.com
- Public route at `/` — no auth required, no AppShell wrapper
- Hero with origin story (Pop Pop legacy), explicit faith statement
- Mission/story section with two-layer model and core themes
- Membership tiers: Founding ($49–65), Core ($85–110, featured), Legacy ($150–200)
- Public events calendar with defensive Supabase query (handles missing table gracefully)
- Contact section with smooth-scroll nav, footer (© 2026 Certago LLC)
- Deployed and verified on Vercel

**M05 — Supabase Schema Audit & Core Tables** ✅ COMPLETE
- Audited existing RogueStats schema: 3 legacy tables (athletes/workouts/workout_stats)
  using PIN-based identity with no RLS — all test data, dropped clean
- Rebuilt from scratch with Supabase Auth as single identity system
- 8 tables total, all with RLS enabled, zero public write exposure
- profiles: auth.uid() linked, role field (member/admin), membership_tier
- workouts + workout_stats: per-user ownership RLS, admin read-all
- events: public read (anon), admin write — Landing page calendar now live
- scenes: 4 seeded presets (Workout, Movie, Game Night, FTMS), admin write
- device_sessions: relay agent (service_role) writes, members read active
- device_streams: relay agent writes, claimed athlete + admin read
- device_claims: athlete insert/update own, UNIQUE(session_id, athlete_id)
- Auth trigger on_auth_user_created auto-creates profile row on signup
- ⚠️ Pi 5 relay agent (M11) must use Supabase service role key for writes — never the anon/publishable key

### ATHLETE FEATURES

**M06 — Profile & Preferences** 🔲 NOT STARTED
- Athlete edits profile, preferences, notification settings, membership tier
- Avatar upload via Supabase Storage
- *Start prompt:* "Milestone M06: Athlete Profile & Preferences for Miller's Garage. Auth and schema are in place. Build a mobile-first profile page where athletes can edit display name, preferences, notification settings, and see their membership tier. Avatar upload via Supabase Storage."

**M07 — WodUp Integration** 🔲 NOT STARTED
- WodUp API — log workout, view history, push/pull data
- Active WodUp account exists
- *Start prompt:* "Milestone M07: WodUp Integration for Miller's Garage. I have an active WodUp account. I need to integrate workout logging — athletes can log a workout from the app and have it pushed to WodUp. Also pull workout history from WodUp to display in the app. Research the WodUp API first before writing any code."

---

### FTMS & DEVICE DATA

**M08 — Persist FTMS Sessions** 🔲 NOT STARTED
- Wire existing `src/lib/bluetooth.js` into Supabase
- On connect: create `device_sessions` row
- Stream metrics to `device_streams` table
- On disconnect: close session
- Devices: Rogue Echo Bike (0x2AD2 Indoor Bike Data) + Rogue Ski Erg (0x2AD1 Rowing Machine Data)
- Metrics: watts, cadence/stroke rate, distance, calories, elapsedTime
- *Start prompt:* "Milestone M08: Persist FTMS Sessions for Miller's Garage. There's a working `src/lib/bluetooth.js` that parses FTMS protocol for Echo Bike (characteristic 0x2AD2) and Ski Erg (0x2AD1). Currently data is lost on disconnect. I need to wire this into Supabase: create a device_sessions row on connect, stream metrics rows to device_streams, close session on disconnect. Check the existing schema (M05 complete) before creating new tables."

**M09 — Athlete Device Claim Flow** 🔲 NOT STARTED
- UI shows active unclaimed device sessions
- Athlete taps to claim session
- `device_claims` table updated
- Real-time Supabase subscription replaces polling
- *Start prompt:* "Milestone M09: Athlete Device Claim Flow for Miller's Garage. FTMS sessions are being persisted (M08 complete). Build the UI: show active unclaimed device sessions, athlete taps to claim, device_claims table updated. Use Supabase real-time subscriptions instead of polling. Mobile-first UI."

**M10 — Live Metrics Wall Display** 🔲 NOT STARTED
- Full-screen metrics mode for wall monitors
- Reads from Supabase real-time subscription (no Web Bluetooth needed on display)
- Works on portrait monitor and mirror display
- *Start prompt:* "Milestone M10: Live Metrics Wall Display for Miller's Garage. Device sessions are persisted and claimable (M08+M09 complete). Build a full-screen display mode that reads live metrics from Supabase real-time subscriptions — no Web Bluetooth required on the display device. Optimized for portrait monitor and a 40ft HDMI mirror display."

---

### LOCAL RELAY AGENT (Pi 5)

**M11 — Relay Agent Bootstrap** 🔲 NOT STARTED
- Node.js or Python persistent service on Pi 5
- Authenticated WebSocket/SSE connection to Supabase or lightweight Express relay
- Runs as systemd service
- Pi 5 is on gym WiFi at 192.168.86.x subnet
- *Start prompt:* "Milestone M11: Relay Agent Bootstrap for Miller's Garage. I have a Raspberry Pi 5 on my gym WiFi (192.168.86.x). I need a persistent local service (Node.js or Python, your recommendation) that connects to Supabase via authenticated WebSocket, listens for cloud commands, and runs as a systemd service. This is the foundation — door control, lighting, music, and BLE scanning will all be added to this agent in later milestones."

**M12 — Door Unlock Integration** ✅ COMPLETE (hardware)
- Pico 2 W at `192.168.86.42`, MicroPython HTTP server
- AEDIKO relay module, Atoplee 12V solenoid, 1N4007 flyback diode
- Buck converter 12V→5V for Pico VSYS (pin 39)
- GP15 → relay IN, 200ms pulse, `POST /unlock` confirmed working
- **Remaining (needs M11):** Static IP via DHCP reservation, IoT subnet, JWT auth layer on Node.js fronting Pico
- *Start prompt:* "Milestone M12: Door Unlock Cloud Integration for Miller's Garage. Hardware is complete: Pico 2 W at 192.168.86.42, POST /unlock triggers a 200ms solenoid pulse. Relay agent is running (M11 complete). I need to: 1) assign static IP to Pico via DHCP reservation, 2) wire the cloud command channel through the relay agent to the Pico, 3) add JWT auth so only authorized members can trigger unlock, 4) enforce gym hours on the cloud side before issuing the command."

**M13 — Lighting Scene Control** 🔲 NOT STARTED
- Home Assistant REST API from relay agent
- Named scenes: Workout, Movie, Game Night, FTMS
- WLED REST for zones 2+3, Lutron Caseta for zone 1 via HA
- Cloud triggers scene → relay executes
- *Start prompt:* "Milestone M13: Lighting Scene Control for Miller's Garage. Relay agent is running (M11). I have: Zone 1 (hexagon LEDs) on Lutron Caseta via Home Assistant, Zone 2 (WS2812B ceiling strip) on ESP32+WLED with REST API, Zone 3 (curtain strip) on second ESP32 channel. Home Assistant is running on Mac Mini. I need cloud→relay→HA scene triggering with named scenes: Workout, Movie, Game Night, FTMS. Athletes get limited scene access; admin gets full control."

**M14 — Music Control** 🔲 NOT STARTED
- Relay agent controls playback
- Cloud sends commands, athlete gets limited surface
- *Start prompt:* "Milestone M14: Music Control for Miller's Garage. Relay agent is running (M13 complete). I need cloud-triggered music control through the relay agent. Athletes get a limited control surface (play/pause/skip/volume). Admin gets full control. Advise on best playback integration given my setup: Mac Mini M4, Apple TV, JBL MA310 receiver."

**M15 — Pi BLE Scanner** 🔲 NOT STARTED
- Python bleak service on Pi 5
- Persistent connections to Echo Bike + Ski Erg
- Writes to `device_streams` in Supabase
- Parallel to Web Bluetooth (Pi handles always-on)
- *Start prompt:* "Milestone M15: Pi BLE Scanner for Miller's Garage. Relay agent is running (M11). I need a Python bleak service that runs persistently on the Pi 5, connects to my Rogue Echo Bike and Rogue Ski Erg via FTMS Bluetooth, and streams metrics (watts, cadence/stroke rate, distance, calories) to the device_streams table in Supabase. The Web Bluetooth library in the browser already parses this data — here's the existing code: [paste src/lib/bluetooth.js]."

---

### ACCESS & PRESENCE

**M16 — Gym Presence & Hours Enforcement** 🔲 NOT STARTED
- Geofence or WiFi-based check-in
- Admin-configurable gym hours
- Gate for door unlock, device claim, scene control
- Audit log of all access events
- *Start prompt:* "Milestone M16: Gym Presence & Hours Enforcement for Miller's Garage. I need to verify an athlete is physically at the gym before allowing door unlock, device claiming, and scene control. Options: geofence (lat/lng), WiFi SSID detection, or manual check-in. Gym is in Papillion, NE. Admin should be able to configure allowed hours. All access events should be logged to Supabase."

---

### ADMIN

**M17 — Admin Panel** 🔲 NOT STARTED
- Manage athletes (invite, roles, enable/disable)
- Configure scenes, manage events/calendar
- Usage statistics
- Broadcast announcements
- *Start prompt:* "Milestone M17: Admin Panel for Miller's Garage. Auth and roles are in place (M02). Build an admin-only UI for: managing athletes (invite, set roles, enable/disable), configuring lighting scenes, managing the public events calendar, viewing usage stats (device sessions, attendance), and broadcasting announcements. Steve and Andrea are the admins. Keep it practical — this is managing a community, not a corporation."

---

### MINI APPS (Third Space Features)

**M18 — Poker Tracker** 🔲 NOT STARTED
- Session poker: players, buy-ins, chip counts, cash-outs, history
- *Start prompt:* "Milestone M18: Poker Tracker App for Miller's Garage. Build a mobile-first poker session tracker: add players, record buy-ins, track chip counts, record cash-outs, view session history. Should work well on a tablet or phone during a game night. Integrate with the existing Supabase DB and auth system."

**M19 — Darts Tracker** 🔲 NOT STARTED
- 301/501/cricket, score entry, player stats, history
- *Start prompt:* "Milestone M19: Darts Tracker App for Miller's Garage. Build a mobile-first darts scoring app supporting 301, 501, and Cricket. Score entry, player stats, game history. Integrate with existing Supabase DB and auth. Should display well on the portrait wall monitor as a scoreboard."

**M20 — Cornhole Tracker** 🔲 NOT STARTED
- Match scoring, tournament bracket, player stats
- *Start prompt:* "Milestone M20: Cornhole Tracker App for Miller's Garage. Build a mobile-first cornhole scoring app with match scoring, tournament bracket support, and player stats/history. Integrate with existing Supabase DB and auth."

---

### FUTURE LAYER

**M21 — Faith & Community Layer** 🔲 NOT STARTED
- Bible study calendar, devotional tie-ins
- Accountability cohorts (groups of 5–8, weekly goals + spiritual reflection)
- Faith is the defining value — explicit, not subtle
- *Start prompt:* "Milestone M21: Faith & Community Layer for Miller's Garage. This is the deepest competitive moat. I need: a Bible study / events calendar (admin-managed, publicly visible), devotional tie-ins to workouts, and accountability cohort groups (5–8 people, weekly goals + spiritual reflection). Faith should be explicit and expected — not an add-on. Integrate with existing auth and profile system."

**M22 — IoT Extensibility** 🔲 NOT STARTED
- Generalized cloud→relay command schema
- New devices plug in as relay agent modules
- *Start prompt:* "Milestone M22: IoT Extensibility Layer for Miller's Garage. Relay agent is fully operational. I need a generalized cloud→relay command schema so new IoT devices (TVs, scoreboards, fans, future hardware) can be added as relay agent plugins without changing the cloud API contract. Design the plugin architecture first, then implement."

**M23 — PWA / Mobile Shell** 🔲 NOT STARTED
- Home screen install, offline support, push notifications
- Evaluate Capacitor if native BLE needed on mobile
- *Start prompt:* "Milestone M23: PWA / Mobile Shell for Miller's Garage. Convert the existing React/Vite app into a PWA with home screen install, offline support, and push notifications. Evaluate whether we need Capacitor for native BLE access on mobile or if Web Bluetooth covers our needs."

---

## 📱 Devices & Hardware Reference

| Device | Location | IP / ID | Status |
|---|---|---|---|
| Mac Mini M4 | North wall cabinet | Local static | Central brain |
| Raspberry Pi 5 | North wall cabinet | 192.168.86.x | Ready |
| Raspberry Pi Pico 2 W | Door lock | 192.168.86.42 | ✅ Working |
| Rogue Echo Bike | Gym floor | BT/FTMS | ✅ FTMS parsed |
| Rogue Ski Erg | Gym floor | BT/FTMS | ✅ FTMS parsed |
| ESP32 (WLED Zone 2) | Ceiling | Local WiFi | ✅ REST API |
| ESP32 (WLED Zone 3) | East wall | Local WiFi | ✅ REST API |
| JBL MA310 | Cabinet | HDMI/optical | ✅ AV receiver |
| Apple TV | Cabinet | Local WiFi | ✅ |
| Lutron Caseta | Zone 1 dimmer | via HA | ✅ |

---

## 🌐 Domain & DNS Reference

| Domain | Registrar | DNS | Points to |
|---|---|---|---|
| millersgarage.com | NameBright | Cloudflare | Vercel (production) |
| millersgarage.net | Squarespace | TBD | Redirect to .com |
| millersgarage.org | Squarespace | TBD | Redirect to .com |
| certago.biz | Cloudflare | Cloudflare | — |

Cloudflare account: Steve@certago.biz  
Cloudflare nameservers for millersgarage.com: `aria.ns.cloudflare.com` + `gerardo.ns.cloudflare.com`

---

## 💰 Membership Tiers (Reference)

| Tier | Monthly | Annual | Target |
|---|---|---|---|
| Founding / Community | $49–65 | $490–650 | Build the founding crew |
| Core ★ | $85–110 | $850–1,100 | Primary revenue tier |
| Legacy / VIP | $150–200 | $1,500–2,000 | Anchor pricing psychology |

---

## 📋 How to Use This File

1. **Start a new thread** for each milestone
2. **Title the thread** with the milestone ID: e.g. "M02 — Supabase Auth"
3. **Open with the start prompt** listed under that milestone
4. **Paste this file** at the top of the new thread for full context
5. **Return here** to update milestone status after completion

---

## 🤖 Claude Code Prompt Standards

When working in a milestone thread with Claude Code, always request prompts in the following format:

**Ask Claude Code for phased, copy/paste prompt blocks** — never one giant prompt. Each phase should be self-contained and end with a commit and push.

### Instruction to include in every milestone thread:

> "Please structure all Claude Code instructions as numbered phases. Each phase should be a single copy/paste block I can run in Claude Code. Every phase must end with a git commit and push using a descriptive commit message. Do not combine multiple logical changes into one phase. Wait for me to confirm each phase is complete before giving me the next one."

### Expected phase block format:

```
Phase 1: [Brief description]

[Claude Code instructions here]

When complete, commit and push:
git add .
git commit -m "M##: descriptive message of what was done"
git push
```

### Why phased blocks:
- Each commit is a clean rollback point
- Easier to debug if something breaks mid-milestone
- Keeps Claude Code context focused
- Produces a readable git history that maps to milestone IDs

---

*Miller's Garage · Certago LLC · Papillion, Nebraska · Steve & Andrea Miller*

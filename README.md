# FocusFlow: calm daily planning (Expo · offline-first)

Psychological task prioritisation (🔥 Must / ⭐ Should / ☕ Could / 📥 Brain Dump),
a manual Morning Review rollover, and weekly insights. Runs on iOS, Android and Web
from one codebase. Data lives in on-device SQLite (`expo-sqlite`).

## Run

```bash
npm install
npx expo start          # press i / a / w
```

Web uses SQLite compiled to WebAssembly; `metro.config.js` adds the `.wasm`
extension and the COOP/COEP headers it needs. If you host the web build
yourself, your server must send the same two headers.

## Folder structure

```
app/                          expo-router: file = route
  _layout.tsx                 fonts, SQLiteProvider (+migrations), store bootstrap, Stack
  rollover.tsx                Morning Review (full-screen modal)
  (tabs)/
    _layout.tsx               tab bar + useRolloverGate()
    index.tsx                 Daily View
    insights.tsx              Weekly analytics
src/
  components/                 TaskItem (strike + haptics), CategorySection, QuickAddFab, ProgressRing
  constants/categories.ts     the 4-category framework: labels, colours, copy, soft limits
  db/
    schema.ts                 versioned SQL migrations
    migrate.ts                PRAGMA user_version runner
    repositories/             ONLY place that writes SQL (tasks, analytics)
  hooks/                      useRolloverGate, useWeeklyStats
  services/insights.ts        pure rule engine → human insights (unit-testable)
  store/useTaskStore.ts       zustand: UI state + optimistic updates over repositories
  theme/                      tokens (light/dark), useTheme
  types/task.ts               domain types + row mappers
  utils/                      local-date helpers, haptics wrapper
```

Layering: **screens → store/hooks → repositories → SQLite**. Swapping SQLite for
an API, or adding sync, only touches `db/` and a future `sync/` module.

## Data model

| table         | purpose |
|---------------|---------|
| `tasks`       | one row per task *per day it was planned*. `scheduled_date` is a local `YYYY-MM-DD` (NULL = Brain Dump). `status`: pending, completed, rolled_over, dropped. `rolled_from_id` + `rollover_count` form the carry-over chain. |
| `day_reviews` | one row per day the Morning Review was completed (gate + "how much did I carry" stats). |
| `task_events` | append-only log (created, completed, moved, rolled_over, dropped…) for streaks and future sync. |
| `settings`    | key/value preferences. |

**Why rollover clones rows instead of changing the date:** yesterday's stats
stay true (yesterday's Must Do stays *missed*), and a task carried 4 times
is visible as a stress signal (`rollover_count`), which feeds the
"break it down or let it go" insight.

## Cloud sync (offline-first)

The app works fully offline. When `EXPO_PUBLIC_API_URL` is set and the user is
signed in, `useCloudSync()` syncs with the API on launch, on returning to the
foreground, when the network comes back, and about 2 s after any local edit.

### Accounts & routing

- `app/(auth)/login.tsx` and `register.tsx` call `useAuthStore`, which wraps `authService`.
- `app/_layout.tsx` uses `Stack.Protected`: signed-out users can only reach `(auth)`,
  and signed-in users only reach `(tabs)` and `rollover`. Signing in, signing out, or the
  server rejecting a token flips the guard, so screens never navigate manually.
- The saved session is read from secure storage at launch (no network needed), and the splash
  screen stays up until it is loaded, so the wrong screen never flashes.
- With no `EXPO_PUBLIC_API_URL`, the app skips accounts entirely and runs local-only.
- The **Account** tab shows the profile, sync status (with "Sync now"), and sign-out. Sign-out
  asks for confirmation and warns if unsynced changes would be lost.

### Run the API

```bash
cd server
cp .env.example .env      # set MONGODB_URI and a long random JWT_SECRET
npm install
npm run dev               # http://localhost:4000
npm test                  # integration tests (in-memory MongoDB, downloads mongod on first run)
```

Then in the app root: `cp .env.example .env` and set `EXPO_PUBLIC_API_URL`.
On a physical phone, use your computer's LAN IP instead of `localhost`.

### Endpoints

| method | path | auth | body |
|---|---|---|---|
| POST | `/api/auth/register` | none | `{ email, password, name? }` → `{ token, user }` |
| POST | `/api/auth/login` | none | `{ email, password }` → `{ token, user }` |
| GET | `/api/auth/me` | Bearer | → `{ user }` |
| POST | `/api/auth/logout-all` | Bearer | revokes every token for the user |
| POST | `/api/sync` | Bearer | see below |

### `/api/sync` protocol

Request: `{ device_id, last_sync_timestamp, cursor, changes: Task[] (≤500) }`
Response: `{ server_time, accepted[{id, updated_at}], conflicts[id], rejected[{id, reason}], changes: Task[], has_more, cursor }`

- **Conflict rule: last-write-wins on the client's `updated_at`**, applied
  atomically by MongoDB: `updateOne({ _id, user_id, updated_at: { $lt: incoming } }, …, { upsert: true })`.
  If the server copy is the same age or newer, the upsert hits a duplicate key and the
  push is reported as a conflict, with the winning server copy in `changes`. Ties go to the server.
- **"What changed" uses the server clock** (`server_updated_at`), not device clocks, so a
  phone with a wrong clock can't make the laptop miss changes. The pull re-reads a 5 s
  overlap window to cover in-flight writes; re-applying a record is harmless.
- Client clocks more than 5 min ahead of the server are clamped, so they can't win every conflict.
- Pulls are paginated by `(server_updated_at, _id)` with an opaque `cursor`.
- Deletions sync as tombstones (`deleted_at`).
- A UUID owned by another account is rejected (`id_conflict`) and never leaked.

Client (`src/sync/`):
- `syncEngine.ts` pushes dirty rows in batches of 200, ordered by `(updated_at, id)`. In
  one SQLite transaction per round it marks accepted rows synced (**only if not
  edited while the request was in flight**), parks rejected rows as `error`, and
  UPSERTs server changes with the same last-write-wins rule
  (`ON CONFLICT DO UPDATE … WHERE excluded.updated_at >= tasks.updated_at`).
  `last_sync_timestamp` advances only after a full successful session.
- Rollover copies use deterministic ids (hash of task id + day), so two devices doing
  the Morning Review offline merge instead of duplicating.
- Sign-out wipes local data. An expired token keeps local data, and signing in again resumes.

Tests: `npm test` (client engine on real SQLite with two simulated devices) and
`cd server && npm test` (API against MongoDB).

### Known limitations
- Last-write-wins is per task, not per field. Simultaneous edits to different fields of the
  same task keep only the later edit.
- `task_events` (local history) and `day_reviews` are not synced. Analytics are computed
  from `tasks`, which are synced, so insights match across devices.
- Tombstones are kept forever. Add a TTL purge (e.g. 90 days) plus a "full resync"
  path for devices offline longer than that.

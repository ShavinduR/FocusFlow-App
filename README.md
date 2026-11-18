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

## MERN sync roadmap

Already prepared in the schema: UUID ids (become `clientId` in Mongo),
`updated_at`, `deleted_at` tombstones, and a `sync_status` dirty flag.

1. `POST /sync/push`: send rows where `sync_status='dirty'`; server upserts by `clientId`, last-write-wins on `updatedAt`.
2. `GET /sync/pull?since=<cursor>`: apply server changes locally; store the cursor in `settings`.
3. Mark pushed rows `synced`. Trigger on app foreground and on reconnect (`@react-native-community/netinfo`).
4. Mongo `tasks` collection mirrors the table (+ `userId`), with an index on `{ userId, updatedAt }`.

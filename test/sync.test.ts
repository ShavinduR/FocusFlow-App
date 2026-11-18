/**
 * Client sync tests: the real sync engine + SQL running on real SQLite
 * (node:sqlite), two simulated devices, and an in-memory server that
 * implements the same protocol rules as server/src/services/sync.service.ts.
 *   npm test
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '../src/db/schema';
import { PUSH_BATCH, runSyncSession } from '../src/sync/syncEngine';
import type { SqlDb, SyncRequestBody, SyncResponseBody, WireTask } from '../src/sync/types';

// ─── SQLite adapter (same surface as expo-sqlite) ─────────────────────────
type Db = SqlDb & { raw: DatabaseSync };
function openDb(upTo = MIGRATIONS.length): Db {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = OFF');
  MIGRATIONS.slice(0, upTo).forEach((m, i) => { raw.exec('BEGIN'); raw.exec(m); raw.exec('COMMIT'); raw.exec(`PRAGMA user_version = ${i + 1}`); });
  raw.exec('PRAGMA foreign_keys = ON');
  return {
    raw,
    runAsync: async (sql, ...p) => ({ changes: Number(raw.prepare(sql).run(...p).changes) }),
    getAllAsync: async <T>(sql: string, ...p: (string | number | null)[]) => raw.prepare(sql).all(...p) as T[],
    getFirstAsync: async <T>(sql: string, ...p: (string | number | null)[]) => (raw.prepare(sql).get(...p) as T) ?? null,
    withTransactionAsync: async (fn) => {
      raw.exec('BEGIN');
      try { await fn(); raw.exec('COMMIT'); } catch (e) { raw.exec('ROLLBACK'); throw e; }
    },
  };
}

// ─── Fake server (mirrors the real protocol) ──────────────────────────────
class FakeServer {
  docs = new Map<string, { t: WireTask; sua: number }>();
  clock = 1_000_000;
  pageSize = 500;
  rejectIds = new Set<string>();
  requests = 0;

  handle(body: SyncRequestBody): SyncResponseBody {
    this.requests++;
    const now = (this.clock += 1000);
    const accepted: SyncResponseBody['accepted'] = [];
    const conflicts: WireTask[] = [];
    const rejected: SyncResponseBody['rejected'] = [];
    for (const c of body.changes) {
      if (this.rejectIds.has(c.id)) { rejected.push({ id: c.id, reason: 'invalid' }); continue; }
      const cur = this.docs.get(c.id);
      if (!cur || cur.t.updated_at < c.updated_at) {
        this.docs.set(c.id, { t: { ...c, created_at: cur?.t.created_at ?? c.created_at }, sua: now });
        accepted.push({ id: c.id, updated_at: c.updated_at });
      } else conflicts.push(cur.t);
    }
    const acceptedIds = new Set(accepted.map((a) => a.id));
    let rows = [...this.docs.values()].filter((d) => !acceptedIds.has(d.t.id));
    if (body.cursor) {
      const cur = JSON.parse(body.cursor) as { sua: number; id: string };
      rows = rows.filter((d) => d.sua > cur.sua || (d.sua === cur.sua && d.t.id > cur.id));
    } else if (body.last_sync_timestamp) {
      const since = Date.parse(body.last_sync_timestamp) - 5000;
      rows = rows.filter((d) => d.sua > since);
    }
    rows.sort((a, b) => a.sua - b.sua || (a.t.id < b.t.id ? -1 : 1));
    const page = rows.slice(0, this.pageSize);
    const hasMore = rows.length > this.pageSize;
    const last = page[page.length - 1];
    const changes = new Map<string, WireTask>();
    [...conflicts, ...page.map((d) => d.t)].forEach((t) => changes.set(t.id, t));
    return {
      server_time: new Date(now).toISOString(),
      accepted, conflicts: conflicts.map((t) => t.id), rejected,
      changes: [...changes.values()],
      has_more: hasMore,
      cursor: hasMore ? JSON.stringify({ sua: last.sua, id: last.t.id }) : null,
    };
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────
let tick = Date.parse('2026-11-18T08:00:00.000Z');
const nextTs = () => new Date((tick += 1000)).toISOString();

async function createTask(db: Db, title: string, extra: Partial<WireTask> = {}) {
  const id = extra.id ?? randomUUID();
  const ts = nextTs();
  await db.runAsync(
    `INSERT INTO tasks (id, title, category, status, scheduled_date, sort_order, rolled_from_id, created_at, updated_at)
     VALUES (?, ?, 'must', 'pending', '2026-11-18', 0, ?, ?, ?)`,
    id, title, extra.rolled_from_id ?? null, ts, ts,
  );
  return id;
}
const edit = (db: Db, id: string, set: string, ...p: (string | number)[]) =>
  db.runAsync(`UPDATE tasks SET ${set}, updated_at = ?, sync_status = 'dirty' WHERE id = ?`, ...p, nextTs(), id);
const row = (db: Db, id: string) =>
  db.getFirstAsync<WireTask & { sync_status: string }>('SELECT * FROM tasks WHERE id = ?', id);
const device = (db: Db, server: FakeServer, send?: (b: SyncRequestBody) => Promise<SyncResponseBody>) =>
  runSyncSession({ db, deviceId: randomUUID(), send: send ?? (async (b) => server.handle(b)) });

// ─── tests ────────────────────────────────────────────────────────────────
describe('migration v2', () => {
  test('preserves v1 data and allows a task whose parent is not present', async () => {
    const v1 = openDb(1);
    v1.raw.exec(`INSERT INTO tasks (id,title,category,status,created_at,updated_at) VALUES ('a','old','must','pending','x','x')`);
    v1.raw.exec('PRAGMA foreign_keys = OFF');
    v1.raw.exec('BEGIN'); v1.raw.exec(MIGRATIONS[1]); v1.raw.exec('COMMIT');
    v1.raw.exec('PRAGMA foreign_keys = ON');
    assert.equal((await row(v1, 'a'))?.title, 'old');
    await createTask(v1, 'orphan', { rolled_from_id: 'missing-parent' }); // would throw with the v1 FK
    v1.raw.exec(`UPDATE tasks SET sync_status = 'error' WHERE id = 'a'`); // new status allowed
  });
});

describe('two-device sync', () => {
  test('create on phone → appears on laptop; complete on laptop → appears on phone', async () => {
    const server = new FakeServer();
    const phone = openDb(), laptop = openDb();
    const id = await createTask(phone, 'Finish chemistry');

    const r1 = await device(phone, server);
    assert.equal(r1.pushed, 1);
    assert.equal((await row(phone, id))?.sync_status, 'synced');

    const r2 = await device(laptop, server);
    assert.equal(r2.appliedLocally, 1);
    assert.equal((await row(laptop, id))?.title, 'Finish chemistry');

    await edit(laptop, id, `status = 'completed'`);
    await device(laptop, server);
    await device(phone, server);
    assert.equal((await row(phone, id))?.status, 'completed');
    assert.equal((await row(phone, id))?.sync_status, 'synced');
  });

  test('offline edits on both devices: the later edit wins everywhere', async () => {
    const server = new FakeServer();
    const phone = openDb(), laptop = openDb();
    const id = await createTask(phone, 'Original');
    await device(phone, server);
    await device(laptop, server);

    await edit(phone, id, 'title = ?', 'Phone edit (earlier)');
    await edit(laptop, id, 'title = ?', 'Laptop edit (later)');

    await device(laptop, server); // later edit reaches server first
    const r = await device(phone, server); // earlier edit loses
    assert.equal(r.conflicts, 1);
    assert.equal((await row(phone, id))?.title, 'Laptop edit (later)');
    assert.equal((await row(phone, id))?.sync_status, 'synced');

    await device(laptop, server);
    assert.equal((await row(laptop, id))?.title, 'Laptop edit (later)');
  });

  test('earlier edit syncing FIRST still loses to the later one', async () => {
    const server = new FakeServer();
    const phone = openDb(), laptop = openDb();
    const id = await createTask(phone, 'Original');
    await device(phone, server);
    await device(laptop, server);

    await edit(phone, id, 'title = ?', 'Phone (earlier)');
    await edit(laptop, id, 'title = ?', 'Laptop (later)');
    await device(phone, server);  // earlier edit accepted first
    await device(laptop, server); // later edit overwrites it
    await device(phone, server);
    assert.equal((await row(phone, id))?.title, 'Laptop (later)');
    assert.equal((await row(laptop, id))?.title, 'Laptop (later)');
  });

  test('deletions (tombstones) propagate', async () => {
    const server = new FakeServer();
    const phone = openDb(), laptop = openDb();
    const id = await createTask(phone, 'Delete me');
    await device(phone, server);
    await device(laptop, server);
    await edit(phone, id, 'deleted_at = ?', new Date().toISOString());
    await device(phone, server);
    await device(laptop, server);
    assert.ok((await row(laptop, id))?.deleted_at);
  });
});

describe('robustness', () => {
  test('an edit made while the request is in flight is NOT marked synced', async () => {
    const server = new FakeServer();
    const phone = openDb();
    const id = await createTask(phone, 'v1');
    await device(phone, server, async (body) => {
      await edit(phone, id, 'title = ?', 'v2 (typed during sync)');
      return server.handle(body);
    });
    const r = await row(phone, id);
    assert.equal(r?.title, 'v2 (typed during sync)');
    assert.equal(r?.sync_status, 'dirty', 'must be pushed next time');
    await device(phone, server);
    assert.equal(server.docs.get(id)?.t.title, 'v2 (typed during sync)');
  });

  test('a stale server copy never overwrites a newer local edit', async () => {
    const server = new FakeServer();
    const phone = openDb(), laptop = openDb();
    const id = await createTask(phone, 'v1');
    await device(phone, server);
    await device(laptop, server);
    await edit(laptop, id, 'title = ?', 'laptop newer, not yet synced');
    await device(laptop, server, async (b) => server.handle({ ...b, changes: [] })); // pull only
    assert.equal((await row(laptop, id))?.title, 'laptop newer, not yet synced');
    assert.equal((await row(laptop, id))?.sync_status, 'dirty');
  });

  test(`batches pushes (> ${PUSH_BATCH}) and pages pulls; every row arrives once`, async () => {
    const server = new FakeServer();
    server.pageSize = 70;
    const phone = openDb(), laptop = openDb();
    for (let i = 0; i < 450; i++) await createTask(phone, `task ${i}`);
    const r1 = await device(phone, server);
    assert.equal(r1.pushed, 450);
    assert.equal(server.docs.size, 450);
    const left = await phone.getFirstAsync<{ n: number }>(`SELECT COUNT(*) n FROM tasks WHERE sync_status != 'synced'`);
    assert.equal(left?.n, 0);

    const r2 = await device(laptop, server);
    assert.equal(r2.appliedLocally, 450);
    const count = await laptop.getFirstAsync<{ n: number }>('SELECT COUNT(*) n FROM tasks');
    assert.equal(count?.n, 450);
  });

  test('a permanently rejected row is parked as error and the session terminates', async () => {
    const server = new FakeServer();
    const phone = openDb();
    const bad = await createTask(phone, 'bad');
    const good = await createTask(phone, 'good');
    server.rejectIds.add(bad);
    const r = await device(phone, server);
    assert.equal(r.rejected, 1);
    assert.equal(server.requests, 1);
    assert.equal((await row(phone, bad))?.sync_status, 'error');
    assert.equal((await row(phone, good))?.sync_status, 'synced');
  });

  test('network failure mid-session leaves data dirty and the cursor unchanged', async () => {
    const server = new FakeServer();
    const phone = openDb();
    const id = await createTask(phone, 'unsent');
    await assert.rejects(device(phone, server, async () => { throw new Error('offline'); }));
    assert.equal((await row(phone, id))?.sync_status, 'dirty');
    assert.equal(await phone.getFirstAsync(`SELECT value FROM settings WHERE key = 'last_sync_timestamp'`), null);
    await device(phone, server);
    assert.equal((await row(phone, id))?.sync_status, 'synced');
  });

  test('re-applying the same server data is idempotent (overlap window)', async () => {
    const server = new FakeServer();
    const phone = openDb(), laptop = openDb();
    const id = await createTask(phone, 'x');
    await device(phone, server);
    await device(laptop, server);
    const r = await device(laptop, server); // overlap re-sends it
    assert.equal((await row(laptop, id))?.title, 'x');
    assert.equal(r.pushed, 0);
  });
});

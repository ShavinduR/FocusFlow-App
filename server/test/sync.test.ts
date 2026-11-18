/**
 * Integration tests against a real (in-memory) MongoDB.
 *   npm test
 * mongodb-memory-server downloads a mongod binary on first run.
 */
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import type { Express } from 'express';

let mongo: MongoMemoryServer;
let app: Express;

before(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongo.getUri();
  process.env.JWT_SECRET = 'test-secret-that-is-definitely-longer-than-32-chars';
  const { connectDb } = await import('../src/db/connect.js');
  const { createApp } = await import('../src/app.js');
  await connectDb(mongo.getUri());
  app = createApp();
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await mongoose.connection.db!.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
});

// ─── helpers ──────────────────────────────────────────────────────────────
async function signUp(email = `u${randomUUID().slice(0, 8)}@test.dev`) {
  const res = await request(app).post('/api/auth/register').send({ email, password: 'correct horse battery' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.token as string;
}

function task(overrides: Record<string, unknown> = {}) {
  const ts = new Date().toISOString();
  return {
    id: randomUUID(), title: 'Write essay', notes: null, category: 'must', status: 'pending',
    scheduled_date: '2026-11-18', sort_order: 1, rolled_from_id: null, rollover_count: 0,
    created_at: ts, updated_at: ts, completed_at: null, deleted_at: null, ...overrides,
  };
}

const sync = (token: string, body: Record<string, unknown>) =>
  request(app).post('/api/sync').set('Authorization', `Bearer ${token}`).send(body);

const at = (ms: number) => new Date(Date.now() + ms).toISOString();

// ─── auth ─────────────────────────────────────────────────────────────────
describe('auth', () => {
  test('register, duplicate email, login, wrong password, me', async () => {
    const email = 'Student@Example.com';
    await signUp(email);
    const dup = await request(app).post('/api/auth/register').send({ email: 'student@example.com', password: 'another password' });
    assert.equal(dup.status, 409);

    const ok = await request(app).post('/api/auth/login').send({ email, password: 'correct horse battery' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.email, 'student@example.com');
    assert.equal(ok.body.user.password_hash, undefined);

    const bad = await request(app).post('/api/auth/login').send({ email, password: 'nope' });
    assert.equal(bad.status, 401);

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${ok.body.token}`);
    assert.equal(me.status, 200);
  });

  test('sync requires a valid token; logout-all revokes it', async () => {
    assert.equal((await sync('garbage', {})).status, 401);
    const token = await signUp();
    assert.equal((await sync(token, {})).status, 200);
    await request(app).post('/api/auth/logout-all').set('Authorization', `Bearer ${token}`).expect(204);
    assert.equal((await sync(token, {})).status, 401);
  });
});

// ─── sync ─────────────────────────────────────────────────────────────────
describe('sync', () => {
  test('a task pushed by one device is pulled by another', async () => {
    const token = await signUp();
    const t = task();
    const push = await sync(token, { device_id: 'phone', last_sync_timestamp: null, changes: [t] });
    assert.equal(push.status, 200);
    assert.deepEqual(push.body.accepted, [{ id: t.id, updated_at: t.updated_at }]);
    assert.equal(push.body.changes.length, 0, 'own accepted writes are not echoed');

    const pull = await sync(token, { device_id: 'laptop', last_sync_timestamp: null, changes: [] });
    assert.equal(pull.body.changes.length, 1);
    assert.deepEqual(pull.body.changes[0], t);
  });

  test('last-write-wins: newer update wins, older update is a conflict that returns the server copy', async () => {
    const token = await signUp();
    const t = task({ updated_at: at(-10_000) });
    await sync(token, { changes: [t] });

    // Laptop completed it 5s ago (newer) → accepted
    const newer = { ...t, status: 'completed', completed_at: at(-5_000), updated_at: at(-5_000) };
    const r1 = await sync(token, { changes: [newer] });
    assert.equal(r1.body.accepted.length, 1);

    // Phone (offline earlier) renamed it 8s ago (older than laptop's edit) → loses
    const stale = { ...t, title: 'Renamed offline', updated_at: at(-8_000) };
    const r2 = await sync(token, { changes: [stale] });
    assert.deepEqual(r2.body.accepted, []);
    assert.deepEqual(r2.body.conflicts, [t.id]);
    const winner = r2.body.changes.find((c: { id: string }) => c.id === t.id);
    assert.equal(winner.status, 'completed');
    assert.equal(winner.title, 'Write essay');
  });

  test('equal updated_at: server copy wins (deterministic tie-break)', async () => {
    const token = await signUp();
    const t = task();
    await sync(token, { changes: [t] });
    const r = await sync(token, { changes: [{ ...t, title: 'same timestamp' }] });
    assert.deepEqual(r.body.conflicts, [t.id]);
  });

  test('created_at is immutable once stored', async () => {
    const token = await signUp();
    const t = task({ updated_at: at(-5_000) });
    await sync(token, { changes: [t] });
    await sync(token, { changes: [{ ...t, created_at: '2000-01-01T00:00:00.000Z', updated_at: at(-1_000) }] });
    const pull = await sync(token, { changes: [] });
    assert.equal(pull.body.changes[0].created_at, t.created_at);
  });

  test('deletions sync as tombstones', async () => {
    const token = await signUp();
    const t = task({ updated_at: at(-5_000) });
    await sync(token, { changes: [t] });
    const first = await sync(token, { changes: [] });

    await sync(token, { changes: [{ ...t, deleted_at: at(-1_000), updated_at: at(-1_000) }] });
    const pull = await sync(token, { last_sync_timestamp: first.body.server_time, changes: [] });
    assert.equal(pull.body.changes.length, 1);
    assert.ok(pull.body.changes[0].deleted_at);
  });

  test('incremental pull only returns records changed since last_sync_timestamp (minus overlap)', async () => {
    const token = await signUp();
    await sync(token, { changes: [task()] });
    const { body } = await sync(token, { changes: [] });

    // Pretend the device synced long after: nothing new (outside the 5s overlap window)
    const later = new Date(Date.parse(body.server_time) + 60_000).toISOString();
    const r = await sync(token, { last_sync_timestamp: later, changes: [] });
    assert.equal(r.body.changes.length, 0);
  });

  test('users are isolated, and a foreign UUID cannot be overwritten', async () => {
    const alice = await signUp();
    const bob = await signUp();
    const t = task();
    await sync(alice, { changes: [t] });

    const hijack = await sync(bob, { changes: [{ ...t, title: 'pwned', updated_at: at(1_000) }] });
    assert.deepEqual(hijack.body.accepted, []);
    assert.deepEqual(hijack.body.rejected, [{ id: t.id, reason: 'id_conflict' }]);
    assert.equal(hijack.body.changes.length, 0, "bob must never receive alice's data");

    const alicePull = await sync(alice, { changes: [] });
    assert.equal(alicePull.body.changes[0].title, 'Write essay');
  });

  test('one invalid record is rejected without failing the batch', async () => {
    const token = await signUp();
    const good = task();
    const bad = { ...task(), category: 'urgent' };
    const r = await sync(token, { changes: [good, bad] });
    assert.equal(r.status, 200);
    assert.equal(r.body.accepted.length, 1);
    assert.equal(r.body.rejected.length, 1);
    assert.equal(r.body.rejected[0].id, bad.id);
  });

  test('client clocks far in the future are clamped to server time', async () => {
    const token = await signUp();
    const t = task({ updated_at: '2099-01-01T00:00:00.000Z' });
    const r = await sync(token, { changes: [t] });
    assert.ok(Date.parse(r.body.accepted[0].updated_at) <= Date.now());
  });

  test('pull is paginated with a cursor and returns every record exactly once', async () => {
    const token = await signUp();
    const all = Array.from({ length: 650 }, (_, i) => task({ title: `t${i}` }));
    await sync(token, { changes: all.slice(0, 400) });
    await sync(token, { changes: all.slice(400) });

    const seen = new Set<string>();
    let cursor: string | null = null;
    let pages = 0;
    do {
      const r = await sync(token, { last_sync_timestamp: null, cursor, changes: [] });
      r.body.changes.forEach((c: { id: string }) => seen.add(c.id));
      cursor = r.body.cursor;
      pages++;
      if (!r.body.has_more) break;
    } while (pages < 10);

    assert.equal(pages, 2);
    assert.equal(seen.size, 650);
  });

  test('rejects oversized batches and malformed cursors', async () => {
    const token = await signUp();
    const tooMany = Array.from({ length: 501 }, () => task());
    assert.equal((await sync(token, { changes: tooMany })).status, 400);
    assert.equal((await sync(token, { cursor: 'not-a-cursor', changes: [] })).status, 400);
  });
});

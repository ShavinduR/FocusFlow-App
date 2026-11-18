import { Schema, model, type InferSchemaType } from 'mongoose';

export const TASK_CATEGORIES = ['must', 'should', 'could', 'brain_dump'] as const;
export const TASK_STATUSES = ['pending', 'completed', 'rolled_over', 'dropped'] as const;

/**
 * Mirrors the client's SQLite `tasks` table 1:1 (snake_case on purpose, so
 * the wire format needs no mapping).
 *
 * Two clocks:
 *  - updated_at        set by the CLIENT when the user edits. Drives
 *                      last-write-wins conflict resolution.
 *  - server_updated_at set by the SERVER on every accepted write. Drives
 *                      "what changed since my last sync". Using the server
 *                      clock for this means a device with a wrong clock can
 *                      never cause other devices to miss changes.
 */
const taskSchema = new Schema(
  {
    _id: { type: String, required: true }, // client-generated UUID
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, maxlength: 500 },
    notes: { type: String, default: null, maxlength: 5000 },
    category: { type: String, enum: TASK_CATEGORIES, required: true },
    status: { type: String, enum: TASK_STATUSES, required: true, default: 'pending' },
    scheduled_date: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
    sort_order: { type: Number, default: 0 },
    rolled_from_id: { type: String, default: null },
    rollover_count: { type: Number, default: 0, min: 0 },
    created_at: { type: Date, required: true },
    updated_at: { type: Date, required: true },
    completed_at: { type: Date, default: null },
    deleted_at: { type: Date, default: null }, // tombstone: deletions must sync too
    server_updated_at: { type: Date, required: true },
    last_modified_by: { type: String, default: null }, // device id, for debugging
  },
  { versionKey: false },
);

// Pull query: { user_id, server_updated_at > X } sorted by (server_updated_at, _id).
taskSchema.index({ user_id: 1, server_updated_at: 1, _id: 1 });
// Day view queries if the server ever serves a web client directly.
taskSchema.index({ user_id: 1, scheduled_date: 1 });

export type Task = InferSchemaType<typeof taskSchema> & { _id: string };
export const TaskModel = model('Task', taskSchema);

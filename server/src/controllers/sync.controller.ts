import type { Request, Response } from 'express';
import { parseOrThrow } from '../middleware/validate.js';
import { syncTasks } from '../services/sync.service.js';
import { SyncRequestSchema } from '../validation/schemas.js';

export async function sync(req: Request, res: Response) {
  const body = parseOrThrow(SyncRequestSchema, req.body);
  const result = await syncTasks(req.auth!.userId, body);
  res.set('Cache-Control', 'no-store').json(result);
}

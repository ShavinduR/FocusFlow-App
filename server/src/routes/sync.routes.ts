import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { sync } from '../controllers/sync.controller.js';
import { requireAuth } from '../middleware/auth.js';

const syncLimiter = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false });

export const syncRouter = Router().post('/', syncLimiter, requireAuth, sync);

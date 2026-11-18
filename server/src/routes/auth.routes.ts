import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, logoutAll, me, register } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';

// Brute-force protection on credential endpoints.
const credentialLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });

export const authRouter = Router()
  .post('/register', credentialLimiter, register)
  .post('/login', credentialLimiter, login)
  .get('/me', requireAuth, me)
  .post('/logout-all', requireAuth, logoutAll);

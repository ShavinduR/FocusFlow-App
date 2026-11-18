import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.routes.js';
import { syncRouter } from './routes/sync.routes.js';

export function createApp() {
  const app = express();
  const { CORS_ORIGINS, NODE_ENV } = env();

  // Behind a load balancer / PaaS proxy, so rate limiting sees the real client IP.
  if (NODE_ENV === 'production') app.set('trust proxy', 1);

  app.disable('x-powered-by');
  app.use(helmet());
  // Native apps send no Origin header and are unaffected; this only gates browsers (the Expo web build).
  app.use(cors({ origin: CORS_ORIGINS.length ? CORS_ORIGINS : false }));
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/api/auth', authRouter);
  app.use('/api/sync', syncRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/HttpError.js';

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(new HttpError(404, `Route not found: ${req.method} ${req.path}`, 'not_found'));
}

// Express recognises error handlers by their 4-argument signature.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  // body-parser errors
  const type = (err as { type?: string })?.type;
  if (type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'invalid_json', message: 'Malformed JSON body' } });
    return;
  }
  if (type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'payload_too_large', message: 'Request body too large' } });
    return;
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: { code: 'internal', message: 'Something went wrong' } });
}
